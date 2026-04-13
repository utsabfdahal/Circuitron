"""
YOLOv7 detection wrapper  (adapted from experiments/detector.py).

Loads the model once, then exposes:
  - ``detect(image_bytes, ...)``  → YOLO-format label text string
  - ``detect_parsed(image_bytes, ...)``  → list of structured dicts

The label text is identical to what ``detect.py --save-txt --save-conf``
would produce:  ``class xc yc w h confidence``  (normalised to [0, 1]).
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import torch

# ── Component class names (must match training labels) ──────────────────────

COMPONENT_NAMES = [
    "text", "junction", "crossover", "terminal", "gnd", "vss",
    "voltage.dc", "voltage.ac", "voltage.battery", "resistor",
    "resistor.adjustable", "resistor.photo", "capacitor.unpolarized",
    "capacitor.polarized", "capacitor.adjustable", "inductor",
    "inductor.ferrite", "inductor.coupled", "transformer", "diode",
    "diode.light_emitting", "diode.thyrector", "diode.zener", "diac",
    "triac", "thyristor", "varistor", "transistor.bjt", "transistor.fet",
    "transistor.photo", "operational_amplifier",
    "operational_amplifier.schmitt_trigger", "optocoupler",
    "integrated_circuit", "integrated_circuit.ne555",
    "integrated_circuit.voltage_regulator", "xor", "and", "or", "not",
    "nand", "nor", "probe", "probe.current", "probe.voltage", "switch",
    "relay", "socket", "fuse", "speaker", "motor", "lamp", "microphone",
    "antenna", "crystal", "magnetic", "mechanical", "optical",
    "block", "explanatory", "unknown",
]

# Add yolov7 repo to path so its internal imports resolve
_YOLOV7_DIR = str(Path(__file__).resolve().parent.parent / "experiments" / "yolov7")
if _YOLOV7_DIR not in sys.path:
    sys.path.insert(0, _YOLOV7_DIR)

from models.experimental import attempt_load          # noqa: E402
from utils.datasets import letterbox                   # noqa: E402
from utils.general import (                            # noqa: E402
    non_max_suppression, scale_coords, check_img_size,
)
from utils.torch_utils import select_device            # noqa: E402

# ── globals (lazy-loaded) ────────────────────────────────────────────────────
_model = None
_device = None
_stride: int = 32
_names: list[str] = []

_DEFAULT_WEIGHTS = str(
    Path(__file__).resolve().parent.parent / "experiments" / "best.pt"
)


def _load_model(weights: str = _DEFAULT_WEIGHTS, device_id: str = ""):
    """Load the YOLOv7 model (called once on first detect())."""
    global _model, _device, _stride, _names
    _device = select_device(device_id)
    _model = attempt_load(weights, map_location=_device)
    _stride = int(_model.stride.max())
    _names = (
        list(_model.names.values())
        if hasattr(_model, "names") and isinstance(_model.names, dict)
        else (_model.names if hasattr(_model, "names") else [])
    )
    _model.eval()
    print(
        f"[detector] Loaded {weights} on {_device}  "
        f"({len(_names)} classes, stride={_stride})"
    )


# ── Public API ───────────────────────────────────────────────────────────────

def detect(
    image_bytes: bytes,
    *,
    weights: str | None = None,
    img_size: int = 640,
    conf_thres: float = 0.6,
    iou_thres: float = 0.45,
    _decoded_bgr: np.ndarray | None = None,
) -> str:
    """
    Run YOLOv7 inference on raw image bytes.

    Parameters
    ----------
    _decoded_bgr : optional pre-decoded BGR image (np.ndarray).
                   If supplied, *image_bytes* is ignored for decoding,
                   avoiding a redundant cv2.imdecode.

    Returns
    -------
    str : YOLO-format label text (one detection per line):
          ``class xc yc w h confidence``
          where xc/yc/w/h are normalised to [0, 1].
    """
    global _model, _device, _stride

    # lazy-load
    if _model is None:
        _load_model(weights or _DEFAULT_WEIGHTS)

    # decode image (skip if already provided)
    if _decoded_bgr is not None:
        im0 = _decoded_bgr
    else:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        im0 = cv2.imdecode(arr, cv2.IMREAD_COLOR)  # BGR, HWC
    if im0 is None:
        raise ValueError("Could not decode image")
    orig_h, orig_w = im0.shape[:2]

    # preprocess
    imgsz = check_img_size(img_size, s=_stride)
    img = letterbox(im0, imgsz, stride=_stride)[0]  # resized + padded
    img = img[:, :, ::-1].transpose(2, 0, 1)  # BGR→RGB, HWC→CHW
    img = np.ascontiguousarray(img)
    tensor = torch.from_numpy(img).to(_device).float() / 255.0
    if tensor.ndimension() == 3:
        tensor = tensor.unsqueeze(0)

    # inference
    with torch.no_grad():
        pred = _model(tensor, augment=False)[0]

    # NMS
    pred = non_max_suppression(pred, conf_thres, iou_thres)

    # format results as YOLO txt (normalised xywh + conf)
    lines: list[str] = []
    det = pred[0]  # batch size = 1
    if det is not None and len(det):
        det[:, :4] = scale_coords(tensor.shape[2:], det[:, :4], im0.shape).round()

        for *xyxy, conf, cls_id in det:
            x1, y1, x2, y2 = [v.item() for v in xyxy]
            cls_int = int(cls_id.item())
            conf_val = conf.item()
            xc = ((x1 + x2) / 2) / orig_w
            yc = ((y1 + y2) / 2) / orig_h
            bw = (x2 - x1) / orig_w
            bh = (y2 - y1) / orig_h
            lines.append(
                f"{cls_int} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f} {conf_val:.6f}"
            )

    return "\n".join(lines)


def detect_parsed(
    image_bytes: bytes,
    *,
    weights: str | None = None,
    img_size: int = 640,
    conf_thres: float = 0.6,
    iou_thres: float = 0.45,
    _decoded_bgr: np.ndarray | None = None,
) -> tuple[List[Dict[str, Any]], int, int]:
    """
    High-level wrapper: run detection and return structured dicts.

    Returns
    -------
    (detections, img_w, img_h)
    detections : list of dicts with keys
        cls, name, confidence, bbox [x1, y1, x2, y2] (pixel coords)
    """
    # decode image to get dimensions (reuse if already provided)
    if _decoded_bgr is not None:
        im0 = _decoded_bgr
    else:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        im0 = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if im0 is None:
        raise ValueError("Could not decode image")
    orig_h, orig_w = im0.shape[:2]

    label_text = detect(
        image_bytes,
        weights=weights,
        img_size=img_size,
        conf_thres=conf_thres,
        iou_thres=iou_thres,
        _decoded_bgr=im0,
    )

    return parse_label_text(label_text, orig_w, orig_h), orig_w, orig_h


def parse_label_text(
    label_text: str, img_w: int, img_h: int
) -> List[Dict[str, Any]]:
    """Parse YOLO-format label text into a list of detection dicts."""
    results: list[dict[str, Any]] = []
    for line in label_text.strip().splitlines():
        parts = line.strip().split()
        if len(parts) < 5:
            continue
        cls_int = int(parts[0])
        xc, yc, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        conf_val = float(parts[5]) if len(parts) > 5 else 1.0

        # denormalize to pixel coords
        cx = xc * img_w
        cy = yc * img_h
        w = bw * img_w
        h = bh * img_h
        x1 = int(round(cx - w / 2))
        y1 = int(round(cy - h / 2))
        x2 = int(round(cx + w / 2))
        y2 = int(round(cy + h / 2))

        name = (
            _names[cls_int] if _names and cls_int < len(_names)
            else COMPONENT_NAMES[cls_int] if cls_int < len(COMPONENT_NAMES)
            else f"class_{cls_int}"
        )
        results.append({
            "cls": cls_int,
            "name": name,
            "confidence": round(conf_val, 4),
            "bbox": [x1, y1, x2, y2],
        })
    return results
