# Utsab's Unified Circuit Analysis Pipeline

## Architecture

```
Image Upload (Frontend)
       │
       ▼
  POST /api/v1/analyze/upload
       │
       ├─► YOLOv7 Detection  (traced_model.pt via TorchScript)
       │       ├── text boxes ──► EasyOCR (extract component values)
       │       ├── component boxes
       │       └── junction boxes
       │
       ├─► Proximity Mapping  (text → nearest component, greedy 1:1)
       │
       └─► Line Detection    (pipeline.py — skeleton + adjacency graph)
               uses all YOLO bounding boxes for wire tracing
       │
       ▼
  JSON Response → Editable frontend UI
```

## Modules

| File | Purpose |
|------|---------|
| `yolo_detector.py` | Loads `traced_model.pt` with `torch.jit.load`, runs letterbox + NMS |
| `ocr_engine.py` | EasyOCR wrapper — crops text bounding boxes, extracts text |
| `proximity_mapper.py` | Greedy nearest-neighbour text-to-component assignment |
| `unified_pipeline.py` | Orchestrator — calls the above + `pipeline.py` for line detection |

## API Endpoint

```
POST /api/v1/analyze/upload
  - Form field: file (image)
  - Form field: proximity_max_dist (float, default 250)
  
Returns JSON:
{
  "status": "success",
  "filename": "...",
  "data": {
    "image_size": { "width": N, "height": N },
    "components": [...],       // editable list
    "text_regions": [...],     // OCR results, editable
    "junctions": [...],
    "graph": { nodes, edges, num_components },
    "line_detection": { detections, results },
    "images": {
      "skeleton_png": "data:image/png;base64,...",
      "overlay_png": "...",
      "bbox_png": "...",
      "adjacency_graph_png": "..."
    }
  }
}
```

## Frontend

Navigate to `/analyze` or click **Analyze Image** in the header.

1. Drag-and-drop or click to upload a circuit image
2. Pipeline runs automatically
3. Results shown in 5 tabs:
   - **Components** — editable table (ID, type, value, confidence, bbox)
   - **OCR Text** — editable OCR output per text region
   - **Graph** — adjacency graph visualization + node/edge tables
   - **Visual Output** — zoomable skeleton, overlay, bbox images
   - **Raw JSON** — full JSON dump
4. Click **Export JSON** to download the (edited) analysis

## Setup

```bash
cd backend
pip install -r requirements.txt   # includes easyocr, scikit-image, matplotlib
```

The YOLO model `traced_model.pt` must be at `backend/experiments/traced_model.pt`.
