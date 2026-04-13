"""Circuit detection and real-time simulation endpoints"""
from typing import Dict, Any
from fastapi import APIRouter, File, UploadFile, HTTPException, WebSocket
from pathlib import Path
import shutil
import uuid

from app.services.circuit_processor import CircuitProcessor
from app.services.circuit_simulator import CircuitSimulator
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)

# Global instances
circuit_processor = None
circuit_simulator = CircuitSimulator()

# Storage for uploads
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@router.on_event("startup")
async def startup():
    """Initialize circuit processor on startup"""
    global circuit_processor
    try:
        circuit_processor = CircuitProcessor()
        logger.info("Circuit processor initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize circuit processor: {str(e)}")


# ============= CIRCUIT DETECTION ENDPOINTS =============

@router.post("/detect-circuit")
async def detect_circuit(file: UploadFile = File(...)):
    """
    Detect circuit components from image using YOLOv7
    
    Args:
        file: Circuit image (PNG, JPG, JPEG)
        
    Returns:
        Detected components, junctions, and circuit structure
    """
    try:
        if not circuit_processor or not circuit_processor.is_available():
            raise HTTPException(
                status_code=503,
                detail="Circuit processor not available"
            )
        
        # Save uploaded file
        file_extension = Path(file.filename).suffix
        file_path = UPLOAD_DIR / f"{uuid.uuid4()}{file_extension}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Processing circuit image: {file.filename}")
        
        # Process image
        circuit_json = circuit_processor.process_image(str(file_path))
        
        return {
            "status": "success",
            "filename": file.filename,
            "upload_path": str(file_path),
            "circuit_data": circuit_json
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error detecting circuit: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Circuit detection failed: {str(e)}"
        )


# ============= REAL-TIME WEBSOCKET SIMULATION ENDPOINTS =============

@router.websocket("/ws/simulate")
async def websocket_simulate(websocket: WebSocket):
    """
    Real-time circuit simulation streaming via WebSocket
    
    Expected JSON:
    {
        "circuit_json": {...},
        "duration": 0.1,
        "steps": 300
    }
    """
    await websocket.accept()
    
    try:
        data = await websocket.receive_json()
        circuit_json = data.get("circuit_json")
        duration = data.get("duration", 0.1)
        steps = data.get("steps", 300)
        
        if not circuit_json:
            await websocket.send_json({"error": "circuit_json required"})
            await websocket.close()
            return
        
        simulation_id = str(uuid.uuid4())
        
        # Send start message
        await websocket.send_json({
            "type": "start",
            "simulation_id": simulation_id,
            "duration": duration,
            "steps": steps,
            "message": "Circuit simulation started"
        })
        
        # Define streaming callback
        async def stream_callback(point):
            await websocket.send_json({
                "type": "data",
                "time": point.time,
                "v1": point.v1, "v2": point.v2, "v3": point.v3,
                "v_r": point.v_r, "v_l": point.v_l, "v_c": point.v_c,
                "i_circuit": point.i_circuit,
                "p_r": point.p_r, "p_l": point.p_l, "p_c": point.p_c
            })
        
        # Run simulation with streaming
        results = await circuit_simulator.simulate_async(
            circuit_json,
            duration=duration,
            steps=steps,
            callback=stream_callback
        )
        
        # Send completion message
        await websocket.send_json({
            "type": "complete",
            "simulation_id": simulation_id,
            "total_points": len(results),
            "message": "Circuit simulation completed successfully"
        })
        
    except Exception as e:
        logger.error(f"WebSocket simulation error: {str(e)}")
        await websocket.send_json({
            "type": "error",
            "message": str(e)
        })
    finally:
        await websocket.close()




