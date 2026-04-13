"""
Unified circuit-analysis pipeline  (Utsab's approach).

    Image
      │
      ├─► YOLOv7 component detection  (experiments/detector.py style)
      │       ├── text boxes  ──► Custom CRNN OCR (backend/ocr/crnn_last.pth)
      │       └── component boxes
      │
      ├─► Proximity mapping  (text → nearest component)
      │
      └─► Line detection via pipeline.py  (skeleton + adjacency graph)
              uses YOLO bounding boxes to know *where* components are

All stages feed into a single JSON response for the frontend.
"""

from __future__ import annotations

import cv2
import numpy as np
from pathlib import Path
from typing import Any, Dict, List, Optional

from .yolo_detector import detect, detect_parsed, parse_label_text, COMPONENT_NAMES
from .proximity_mapper import map_text_to_components

# Use the custom CRNN OCR service (trained in backend/ocr/EasyOCR.ipynb)
# instead of the old easyocr library wrapper.
from app.services.ocr_service import get_ocr_service

# pipeline.py sits one level up: backend/pipeline.py
import sys
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
from pipeline import analyze as line_detection_analyze  # noqa: E402


# ── numpy → native Python conversion ────────────────────────────────────────

def _sanitize(obj: Any) -> Any:
    """Recursively convert numpy types to JSON-serializable Python types."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


# ── helpers ──────────────────────────────────────────────────────────────────

def _generate_component_id(class_name: str, index: int) -> str:
    """SPICE-style prefix + sequential number."""
    n = class_name.lower()
    if "resistor" in n:
        return f"R{index + 1}"
    if "capacitor" in n:
        return f"C{index + 1}"
    if "inductor" in n:
        return f"L{index + 1}"
    if "diode" in n:
        return f"D{index + 1}"
    if "transistor" in n:
        return f"Q{index + 1}"
    if "voltage" in n:
        return f"V{index + 1}"
    if "switch" in n:
        return f"SW{index + 1}"
    if "gnd" in n or "vss" in n:
        return f"GND{index + 1}"
    return f"U{index + 1}"


def _detections_to_yolo_label_text(
    detections: List[Dict[str, Any]], img_w: int, img_h: int
) -> str:
    """
    Convert pixel-coord detections back to normalised YOLO-format text so
    that ``pipeline.analyze`` can consume them.
    """
    lines: list[str] = []
    for d in detections:
        x1, y1, x2, y2 = d["bbox"]
        xc = ((x1 + x2) / 2) / img_w
        yc = ((y1 + y2) / 2) / img_h
        w = (x2 - x1) / img_w
        h = (y2 - y1) / img_h
        conf = d.get("confidence", 1.0)
        lines.append(f"{d['cls']} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f} {conf:.4f}")
    return "\n".join(lines)


# ── singleton holders (lazy init) ───────────────────────────────────────────

def _get_ocr():
    """Return the global custom CRNN OCR service (lazy singleton)."""
    return get_ocr_service()


# ── PUBLIC ───────────────────────────────────────────────────────────────────

def run_full_pipeline(
    image_bytes: bytes,
    *,
    yolo_model_path: Optional[str] = None,
    proximity_max_dist: float = 250.0,
    line_detection_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    End-to-end analysis of a circuit image.

    Steps
    -----
    1. Decode image
    2. YOLOv7 detection  →  component boxes + text boxes
    3. Custom CRNN OCR on text boxes
    4. Proximity mapping  text → component
    5. Line-detection via pipeline.py  (skeleton, adjacency graph)
    6. Merge everything into one JSON payload

    Returns
    -------
    dict with keys:
        image_size, components, text_regions, junctions, graph, images
    """

    # ── 1. decode ────────────────────────────────────────────────────────
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise ValueError("Could not decode the uploaded image")
    img_h, img_w = int(image_bgr.shape[0]), int(image_bgr.shape[1])

    # ── 2. YOLO detection ────────────────────────────────────────────────
    # detect() returns YOLO label text; detect_parsed() returns dicts.
    # Pass the pre-decoded image to avoid redundant cv2.imdecode.
    label_text = detect(
        image_bytes,
        weights=yolo_model_path,
        _decoded_bgr=image_bgr,
    ) if yolo_model_path else detect(image_bytes, _decoded_bgr=image_bgr)

    all_detections = parse_label_text(label_text, img_w, img_h)

    # Split into categories
    text_boxes = [d for d in all_detections if d["name"] == "text"]
    junction_dets = [
        d for d in all_detections
        if d["name"] in ("junction", "crossover", "terminal")
    ]
    component_dets = [
        d for d in all_detections
        if d["name"] not in ("text", "junction", "crossover", "terminal")
    ]

    # ── 3. Custom CRNN OCR on text boxes ──────────────────────────────────
    ocr = _get_ocr()
    text_results = ocr.extract_texts(image_bgr, text_boxes) if text_boxes else []

    # ── 4. Proximity mapping ─────────────────────────────────────────────
    # Build enriched component list
    components: List[Dict[str, Any]] = []
    for idx, det in enumerate(component_dets):
        cid = _generate_component_id(det["name"], idx)
        cx = (det["bbox"][0] + det["bbox"][2]) / 2
        cy = (det["bbox"][1] + det["bbox"][3]) / 2
        components.append({
            "id": cid,
            "cls": det["cls"],
            "type": det["name"].split(".")[0],
            "name": det["name"],
            "confidence": det["confidence"],
            "bbox": det["bbox"],
            "position": [round(cx, 1), round(cy, 1)],
        })

    components = map_text_to_components(
        components, text_results, max_distance=proximity_max_dist
    )

    # ── 5. Line detection via pipeline.py ────────────────────────────────
    # pipeline.analyze expects the raw image bytes + YOLO-format label text.
    # label_text was already obtained from detect() in step 2.
    line_result = line_detection_analyze(
        image_bytes, label_text, params=line_detection_params
    )

    # ── 6. Assemble response ─────────────────────────────────────────────
    junctions = [
        {
            "id": i,
            "type": j["name"],
            "bbox": j["bbox"],
            "confidence": j["confidence"],
            "position": [
                round((j["bbox"][0] + j["bbox"][2]) / 2, 1),
                round((j["bbox"][1] + j["bbox"][3]) / 2, 1),
            ],
        }
        for i, j in enumerate(junction_dets)
    ]

    text_regions = [
        {
            "id": i,
            "bbox": tr["bbox"],
            "ocr_text": tr.get("ocr_text", ""),
            "ocr_confidence": tr.get("ocr_confidence", 0.0),
        }
        for i, tr in enumerate(text_results)
    ]

    return _sanitize({
        "image_size": {"width": img_w, "height": img_h},
        "components": components,
        "text_regions": text_regions,
        "junctions": junctions,
        "graph": line_result.get("graph", {}),
        "line_detection": {
            "detections": line_result.get("detections", []),
            "results": line_result.get("results", []),
        },
        "images": line_result.get("images", {}),
    })
