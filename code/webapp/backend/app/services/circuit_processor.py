import json
import numpy as np
from pathlib import Path
from typing import Dict, Any, Tuple
import sys
import cv2
from PIL import Image
import torch

from app.core.logging import get_logger
from app.services.ocr_service import get_ocr_service

logger = get_logger(__name__)

# Add YOLOv7 to path
YOLOV7_PATH = str(Path(__file__).resolve().parent.parent.parent / "experiments" / "yolov7")
if YOLOV7_PATH not in sys.path:
    sys.path.insert(0, YOLOV7_PATH)

try:
    from models.experimental import attempt_load
    from utils.general import non_max_suppression, scale_coords
    from utils.datasets import letterbox
    from utils.torch_utils import select_device
    YOLOV7_AVAILABLE = True
except ImportError:
    YOLOV7_AVAILABLE = False
    logger.warning("YOLOv7 not available, circuit detection disabled")


class CircuitProcessor:
    def __init__(self):
        self.model_path = r"D:\Circuitron\backend\model\yolo_v7.pt"
        self.device = select_device('0' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.stride = 32
        self.imgsz = 640
        
        # Load model with weights_only=False for PyTorch 2.6 compatibility
        try:
            if YOLOV7_AVAILABLE:
                try:
                    torch.serialization.add_safe_globals([__import__('numpy').core.multiarray._reconstruct])
                except:
                    pass
                
                # Monkey patch torch.load to handle weights_only for older code
                original_load = torch.load
                def patched_load(f, map_location=None, weights_only=None, **kwargs):
                    try:
                        if weights_only is None:
                            weights_only = False
                        return original_load(f, map_location=map_location, weights_only=weights_only, **kwargs)
                    except:
                        # Fall back to weights_only=False if error
                        return original_load(f, map_location=map_location, weights_only=False, **kwargs)
                
                torch.load = patched_load
                
                self.model = attempt_load(self.model_path, map_location=self.device)
                self.model.eval()
                self.stride = int(self.model.stride.max())
                logger.info(f"YOLOv7 model loaded from {self.model_path}")
        except Exception as e:
            logger.error(f"Failed to load YOLOv7 model: {str(e)}")
            self.model = None
        
        self.class_names = [
            "text", "junction", "crossover", "terminal", "gnd", "vss",
            "voltage.dc", "voltage.ac", "voltage.battery",
            "resistor", "resistor.adjustable", "resistor.photo",
            "capacitor.unpolarized", "capacitor.polarized", "capacitor.adjustable",
            "inductor", "inductor.ferrite", "inductor.coupled", "transformer",
            "diode", "diode.light_emitting", "diode.thyrector", "diode.zener",
            "diac", "triac", "thyristor", "varistor",
            "transistor.bjt", "transistor.fet", "transistor.photo",
            "operational_amplifier", "operational_amplifier.schmitt_trigger",
            "optocoupler", "integrated_circuit", "integrated_circuit.ne555", "integrated_circuit.voltage_regulator",
            "xor", "and", "or", "not", "nand", "nor",
            "probe", "probe.current", "probe.voltage",
            "switch", "relay", "socket", "fuse",
            "speaker", "motor", "lamp", "microphone", "antenna",
            "crystal", "magnetic", "mechanical", "block", "explanatory", "unknown"
        ]

    def is_available(self) -> bool:
        return self.model is not None

    def process_image(self, image_path: str) -> Dict[str, Any]:
        if not self.is_available():
            logger.warning("Circuit processor not available, returning empty circuit")
            return {
                "circuit": {
                    "image": Path(image_path).name,
                    "components_count": 0,
                    "junctions_count": 0,
                    "wires_count": 0,
                    "is_fully_connected": False
                },
                "components": [],
                "junctions": [],
                "wires": [],
                "connections": []
            }
        
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Failed to read image: {image_path}")
            
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            h, w = image.shape[:2]
            
            logger.info(f"Processing circuit image: {image_path}")
            
            # Preprocess for YOLO
            img = letterbox(image, self.imgsz, stride=self.stride)[0]
            img = img[:, :, ::-1].transpose(2, 0, 1)
            img = np.ascontiguousarray(img)
            img = torch.from_numpy(img).to(self.device).float()
            img /= 255.0
            if img.ndimension() == 3:
                img = img.unsqueeze(0)
            
            # Run inference
            with torch.no_grad():
                pred = self.model(img)[0]
            
            # Apply NMS
            conf_thres = 0.35
            iou_thres = 0.45
            pred = non_max_suppression(pred, conf_thres, iou_thres)
            
            # Process detections
            detections = []
            seen_detections = set()
            
            if pred[0] is not None and len(pred[0]):
                det = pred[0].clone()
                det[:, :4] = scale_coords(img.shape[2:], det[:, :4], image.shape).round()
                
                for *xyxy, conf, cls_id in det:
                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    cls_id = int(cls_id)
                    conf = float(conf)
                    
                    det_key = (cls_id, x1, y1, x2, y2)
                    if det_key not in seen_detections:
                        class_name = self.class_names[cls_id] if cls_id < len(self.class_names) else f'unknown_{cls_id}'
                        detections.append({
                            'bbox': [x1, y1, x2, y2],
                            'confidence': conf,
                            'class_id': cls_id,
                            'class_name': class_name
                        })
                        seen_detections.add(det_key)
            
            logger.info(f"Detected {len(detections)} components in circuit image")
            
            # Generate circuit JSON with proper text detection and OCR mapping
            components = [d for d in detections if d['class_name'] not in ['text', 'junction', 'crossover', 'terminal']]
            junctions = [d for d in detections if d['class_name'] in ['junction', 'crossover', 'terminal']]
            text_regions = [d for d in detections if d['class_name'] == 'text']
            
            # Get OCR service for extracting component values
            ocr_service = get_ocr_service()
            
            # STEP 1: Extract text from TEXT detections using OCR
            text_values = {}  # Maps text bbox to extracted value
            if ocr_service.is_available() and text_regions:
                logger.info(f"Extracting text from {len(text_regions)} detected text regions")
                for text_idx, text_det in enumerate(text_regions):
                    try:
                        x1, y1, x2, y2 = text_det['bbox']
                        # Ensure coordinates are valid
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(image_rgb.shape[1], x2), min(image_rgb.shape[0], y2)
                        
                        if x2 > x1 and y2 > y1:
                            # Crop the text region
                            crop = image_rgb[y1:y2, x1:x2]
                            if crop.size > 0:
                                # Run OCR on the cropped text region
                                extracted_text, confidence = ocr_service.extract_text(crop)
                                if extracted_text:
                                    text_bbox_key = tuple(text_det['bbox'])
                                    text_values[text_bbox_key] = {
                                        'text': extracted_text,
                                        'confidence': confidence,
                                        'bbox': text_det['bbox']
                                    }
                                    logger.debug(f"Text region {text_idx}: extracted '{extracted_text}' (conf: {confidence:.3f})")
                    except Exception as e:
                        logger.debug(f"OCR extraction failed for text region {text_idx}: {str(e)}")
            
            logger.info(f"Extracted {len(text_values)} text values from text regions")
            
            # STEP 2: Map text values to components by proximity
            component_list = []
            for idx, comp in enumerate(components):
                comp_id = self._generate_component_id(comp['class_name'], idx)
                comp_center = np.array([
                    (comp['bbox'][0] + comp['bbox'][2]) / 2,
                    (comp['bbox'][1] + comp['bbox'][3]) / 2
                ])
                
                # Find nearest text region to this component
                value, unit = "", ""
                if text_values:
                    nearest_text = None
                    min_distance = float('inf')
                    
                    for text_bbox_key, text_info in text_values.items():
                        text_bbox = text_info['bbox']
                        text_center = np.array([
                            (text_bbox[0] + text_bbox[2]) / 2,
                            (text_bbox[1] + text_bbox[3]) / 2
                        ])
                        
                        # Calculate distance from component to text
                        distance = np.linalg.norm(comp_center - text_center)
                        
                        if distance < min_distance:
                            min_distance = distance
                            nearest_text = text_info
                    
                    # Use nearest text if it's reasonably close (within ~200 pixels)
                    if nearest_text and min_distance < 200:
                        text, conf = nearest_text['text'], nearest_text['confidence']
                        if conf > 0.2:  # Low threshold for OCR confidence
                            value = text  # Keep full text including units
                            logger.debug(f"Component {comp_id}: mapped value '{value}' (distance: {min_distance:.1f}px)")
                
                component_list.append({
                    "id": comp_id,
                    "type": comp['class_name'].split('.')[0],
                    "value": value,
                    "confidence": round(comp['confidence'], 2),
                    "bbox": comp['bbox'],
                    "position": [
                        round((comp['bbox'][0] + comp['bbox'][2])/2, 1), 
                        round((comp['bbox'][1] + comp['bbox'][3])/2, 1)
                    ],
                    "terminals": [
                        {"name": "A", "junction": 0}, 
                        {"name": "B", "junction": 1}
                    ],
                    "connected_to": []
                })
            
            circuit_json = {
                "circuit": {
                    "image": Path(image_path).name,
                    "components_count": len(components),
                    "junctions_count": len(junctions),
                    "wires_count": 0,
                    "is_fully_connected": len(junctions) > 0,
                    "text_regions_detected": len(text_regions),
                    "text_values_extracted": len(text_values)
                },
                "components": component_list,
                "junctions": [
                    {
                        "id": idx,
                        "type": j['class_name'],
                        "position": [
                            round((j['bbox'][0] + j['bbox'][2])/2, 1), 
                            round((j['bbox'][1] + j['bbox'][3])/2, 1)
                        ],
                        "bbox": j['bbox'],
                        "wires": [],
                        "components": []
                    }
                    for idx, j in enumerate(junctions)
                ],
                "wires": [],
                "connections": [],
                "text_regions": [
                    {
                        "id": idx,
                        "bbox": t['bbox'],
                        "extracted_value": text_values.get(tuple(t['bbox']), {}).get('text', '')
                    }
                    for idx, t in enumerate(text_regions)
                ]
            }
            
            return circuit_json
            
        except Exception as e:
            logger.error(f"Error processing circuit image: {str(e)}")
            raise

    def _generate_component_id(self, class_name: str, index: int) -> str:
        """Generate component ID based on class name"""
        if "resistor" in class_name:
            return f"R{index+1}"
        elif "capacitor" in class_name:
            return f"C{index+1}"
        elif "inductor" in class_name:
            return f"L{index+1}"
        elif "diode" in class_name:
            return f"D{index+1}"
        elif "transistor" in class_name:
            return f"Q{index+1}"
        elif "voltage" in class_name:
            return f"V{index+1}"
        elif "switch" in class_name:
            return f"SW{index+1}"
        else:
            return f"U{index+1}"

    def load_circuit_json(self, json_path: str) -> Dict[str, Any]:
        """Load circuit JSON from file"""
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
            logger.info(f"Loaded circuit JSON from {json_path}")
            return data
        except Exception as e:
            logger.error(f"Failed to load circuit JSON: {str(e)}")
            raise
