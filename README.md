# Circuitron

**Electrical Circuit Analysis & Simulation from Hand-Drawn Diagrams**

Circuitron is a final year project that converts hand-drawn electrical circuit diagrams into digital representations with automated component detection, OCR-based value reading, wire/line detection, and circuit simulation.

## Repository Structure

```
Circuitron/
├── code/
│   ├── backend/          # Python pipeline: YOLO detection, OCR, line detection, proximity mapping
│   ├── frontend/         # Next.js frontend (simple version from deployment)
│   └── webapp/           # Full web application (structured backend + rich frontend)
│       ├── backend/      # FastAPI backend with ngspice simulation
│       └── frontend/     # Next.js frontend with circuit editor, simulation, KiCad symbols
├── notebooks/
│   ├── line-detection/   # All line detection algorithm experiments & iterations
│   ├── pipeline/         # Full pipeline notebooks
│   └── experiments/      # YOLO checks, EasyOCR experiments
├── report/               # LaTeX final year project report (source + PDF)
├── docs/
│   ├── readmes/          # Component-specific documentation
│   └── papers/           # Reference papers for line detection algorithms
├── test-images/          # Circuit diagram test images
├── deployment/           # Docker, Railway, Render deployment configs
└── legacy/               # Notes on archived old repos
```

## Key Components

### 1. Component Detection (YOLOv7)
Custom-trained YOLOv7 model for detecting electrical components (resistors, capacitors, inductors, etc.) in hand-drawn circuit images.

### 2. OCR Engine
- **TrOCR**: Transformer-based OCR for component value reading
- **Custom CRNN**: Fine-tuned CRNN model for circuit-specific text

### 3. Line/Wire Detection
Multi-approach line detection algorithm combining:
- Hough Transform
- Skeletonization + BFS pathfinding
- Junction detection
- Crossover handling
- Bézier curve fitting

### 4. Circuit Simulation
- CircuitJS integration for interactive simulation
- ngspice backend for SPICE-level simulation
- Waveform visualization

### 5. Proximity Mapping
Adjacency graph construction connecting detected components via wire paths.

## Setup

### Backend
```bash
cd code/backend/
pip install -r requirements.txt
bash start.sh
```

### Frontend
```bash
cd code/frontend/
npm install
npm run dev
```

### Full Web Application
```bash
cd code/webapp/backend/
pip install -r requirements.txt
cd ../frontend/
npm install
npm run dev
```

## Previous Repositories
This is a unified repository consolidating the following repos:
- `HostingCircuitron` — Latest deployed code (primary source)
- `CircuitronFinalYearProject` — Complete materials collection
- `CircuitronWebApp` — Full web application
- `LineDetection` — Line detection experiments
- `CustomPathFinding` — Advanced line detection with BFS/pathfinding
- `FinalCodeofCircuitron` — Earlier code version
- `CktnFromstart` — Earlier code version
- `Circuitron-Latex-Reportmyversionb` — LaTeX report
- `Circuitron` — Original repo
