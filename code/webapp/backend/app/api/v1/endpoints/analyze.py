"""
/api/v1/analyze  — unified circuit-image analysis endpoint.

Accepts an image upload and runs the full Utsab pipeline:
YOLO → EasyOCR → proximity mapping → line detection (pipeline.py).
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional
import asyncio
import traceback

from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("/upload")
async def analyze_circuit_image(
    file: UploadFile = File(...),
    proximity_max_dist: float = Form(250.0),
):
    """
    Upload a circuit image and get the full analysis result.

    - YOLOv7 component + text detection
    - EasyOCR on detected text boxes
    - Proximity mapping (text → nearest component)
    - Line / wire detection via pipeline.py (skeleton + adjacency graph)

    Returns a JSON payload consumable by the frontend editor.
    """
    # Validate file type
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/bmp", "image/webp"}
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {allowed}",
        )

    try:
        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        logger.info(
            "analyze_circuit_image",
            filename=file.filename,
            size_kb=round(len(image_bytes) / 1024, 1),
        )

        # Lazy import to keep startup fast
        from utsabapproach.unified_pipeline import run_full_pipeline

        # Run CPU-heavy pipeline in a thread so the event loop stays free
        result = await asyncio.to_thread(
            run_full_pipeline,
            image_bytes,
            proximity_max_dist=proximity_max_dist,
        )

        return JSONResponse(content={
            "status": "success",
            "filename": file.filename,
            "data": result,
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
