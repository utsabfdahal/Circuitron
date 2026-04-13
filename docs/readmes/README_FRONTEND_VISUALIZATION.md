# Frontend Visualization — Data Flow, Communication & UI Architecture

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Application Architecture](#3-application-architecture)
4. [Step 1: UploadStep — Image Capture & Threshold Preview](#4-step-1-uploadstep--image-capture--threshold-preview)
5. [Step 2: ReviewStep — Interactive Editing & Diagnostic Views](#5-step-2-reviewstep--interactive-editing--diagnostic-views)
6. [Step 3: SchematicStep — CircuitJS1 Simulation & Chat](#6-step-3-schematicstep--circuitjs1-simulation--chat)
7. [API Communication Layer](#7-api-communication-layer)
8. [Data Flow: End-to-End Pipeline](#8-data-flow-end-to-end-pipeline)
9. [CircuitJS1 Integration — iframe & JS API](#9-circuitjs1-integration--iframe--js-api)
10. [SimulationScope — Waveform Rendering](#10-simulationscope--waveform-rendering)
11. [AI Chat Integration](#11-ai-chat-integration)
12. [SVG Overlay System](#12-svg-overlay-system)
13. [TypeScript Type System](#13-typescript-type-system)
14. [Standalone Simulate Page](#14-standalone-simulate-page)
15. [File Reference](#15-file-reference)
16. [Viva Questions & Answers](#16-viva-questions--answers)

---

## 1. Overview

The **CIRCUITRON frontend** is a single-page Next.js 14 application that provides a three-step guided workflow for converting hand-drawn circuit images into interactive, simulated schematics.

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/frontend_screenshot.png" alt="Frontend Full Screenshot" width="95%">
</p>
<p align="center"><em>Full-screen capture of the CIRCUITRON frontend showing the circuit editor, simulation view, and AI Q&A panel.</em></p>

```
┌────────────┐     ┌────────────┐     ┌──────────────┐
│   UPLOAD   │ ──→ │   REVIEW   │ ──→ │  SCHEMATIC   │
│            │     │   & EDIT   │     │  & SIMULATE  │
│ - Drag/drop│     │ - 6 views  │     │ - CircuitJS1 │
│ - Threshold│     │ - Edit data│     │ - AI Chat    │
│ - OCR mode │     │ - Re-graph │     │ - Waveforms  │
└────────────┘     └────────────┘     └──────────────┘
```

### Key Design Principles

1. **Human-in-the-loop:** ML results are reviewed and correctable before finalization
2. **Real-time feedback:** Threshold changes re-analyze instantly (debounced at 400ms)
3. **Embedded simulation:** CircuitJS1 runs inside the browser — no external tools needed
4. **Conversational AI:** Context-aware chat assistant understands the specific circuit

---

## 2. Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 14.2 | React framework with App Router |
| **React** | 18.3 | UI library |
| **TypeScript** | — | Type-safe development |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **lucide-react** | — | Icon library |
| **react-markdown** | — | Render AI chat responses as Markdown |
| **@tailwindcss/typography** | — | Prose styling for markdown content |
| **CircuitJS1** | (GWT build) | Circuit simulation engine (embedded via iframe) |

### Why Next.js 14?

- **App Router:** File-system-based routing (`app/page.tsx`, `app/simulate/page.tsx`)
- **Server components:** Potential for SSR/SSG (though this app is primarily client-side)
- **Static rewrites:** URL mapping for CircuitJS1 assets (`/circuit/:path*` → `/circuitjs/:path*`)
- **Built-in optimizations:** Image optimization, code splitting, prefetching

---

## 3. Application Architecture

### Component Hierarchy

```
WorkspacePage (main orchestrator)
├── state: step (1|2|3), preview, circuit, cjsText, loading
│
├── UploadStep
│   ├── Drag-and-drop zone
│   ├── OCR mode selector (fast | slow)
│   ├── Threshold preview (Canvas-based)
│   └── Analyzing animation (progress ring + circuit facts)
│
├── ReviewStep
│   ├── Image viewer (6 view modes)
│   ├── SVG overlay layer (components, texts, junctions, graph)
│   ├── Editable sidebar (components, texts, junctions, graph stats)
│   ├── Threshold slider with debounced re-analysis
│   └── Diagnostic image gallery
│
└── SchematicStep
    ├── CircuitJS1 iframe
    ├── Simulation controls (play/pause, timestep, export)
    ├── SimulationScope (canvas waveform renderer)
    └── AI Chat panel (floating window)
```

### State Management

The application uses **React useState hooks** at the `WorkspacePage` level with prop-drilling to child components:

```typescript
// WorkspacePage state
const [step, setStep] = useState<1 | 2 | 3>(1);
const [preview, setPreview] = useState<AnalysisPreview | null>(null);
const [circuit, setCircuit] = useState<Circuit | null>(null);
const [cjsText, setCjsText] = useState<string>("");
const [loading, setLoading] = useState(false);
```

No external state management library (Redux, Zustand) is used — the data flow is simple enough for prop-drilling through 3 components.

---

## 4. Step 1: UploadStep — Image Capture & Threshold Preview

### 4.1 Image Upload

The upload zone supports both drag-and-drop and click-to-browse:

```
┌─────────────────────────────────┐
│                                 │
│    📁 Drag & drop your circuit  │
│       image here, or click      │
│       to browse                 │
│                                 │
│    Supports PNG, JPG, JPEG      │
│                                 │
└─────────────────────────────────┘
```

The user also selects an **OCR mode:**
- **Fast:** Uses only TrOCR (transformer-based OCR), faster but potentially less accurate
- **Slow:** Uses TrOCR + Custom CRNN with confidence comparison, slower but more robust

### 4.2 Client-Side Threshold Preview

Before sending to the backend, the app shows a **real-time preview** of the binary thresholding effect:

```typescript
// Client-side grayscale + threshold preview on <canvas>
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
// Draw image → get pixel data → convert to grayscale → apply threshold
for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    const val = gray < threshold ? 0 : 255;
    data[i] = data[i+1] = data[i+2] = val;
}
```

The user adjusts a slider (range: 30–230) and sees the binary image update in real-time. This helps find the right threshold  before the expensive analysis.

**Side-by-side layout:**
```
┌──────────────────┬──────────────────┐
│   Original       │   Binary Preview │
│   [image]        │   [thresholded]  │
│                  │                  │
├──────────────────┴──────────────────┤
│  Threshold: ████████░░░░░░ 110      │
│  OCR Mode: [Fast] [Slow]            │
│         [🔬 Analyze Circuit]        │
└─────────────────────────────────────┘
```

### 4.3 Analysis Phase

When the user clicks "Analyze Circuit":

1. Image + threshold + OCR mode are sent to `POST /analyze` as `multipart/form-data`
2. A **progress animation** with a fake percentage counter provides visual feedback
3. **18 rotating "Did you know?" facts** about circuits keep the user engaged during the ~2–10 second wait
4. On completion, the app transitions to Step 2 (Review)

---

## 5. Step 2: ReviewStep — Interactive Editing & Diagnostic Views

### 5.1 Six View Modes

The review step provides six different visualizations of the analysis results:

| Skeleton View | Wire Overlay with Endpoints | Adjacency Graph |
|---|---|---|
| <img src="../circuitron_final_report/src/images/figures/skeletonvdivider.png" alt="Skeleton" width="280"> | <img src="../circuitron_final_report/src/images/figures/skeletonwithendpointvdivider.png" alt="Wire Overlay" width="280"> | <img src="../circuitron_final_report/src/images/figures/adjancyvdivider.png" alt="Adjacency Graph" width="280"> |

<p align="center"><em>Three of the six diagnostic views available during the Review step: skeleton centerlines, wire overlay with endpoint markers, and the adjacency graph.</em></p>

| # | Mode | Description |
|---|---|---|
| 1 | **Annotated** | Backend-generated image with all detections drawn |
| 2 | **Original + Overlays** | Original image with interactive SVG overlays (toggleable) |
| 3 | **Skeleton** | Diagnostic skeleton image (black/white wire centerlines) |
| 4 | **Wire Overlay** | Skeleton overlaid on the original with endpoint markers |
| 5 | **Detection Boxes** | Color-coded bounding boxes per component class |
| 6 | **Adjacency Graph** | Matplotlib scatter plot of graph nodes and edges |

### 5.2 SVG Overlay System

In "Original + Overlays" mode, four toggleable SVG layers are rendered on top of the original image:

```
Base layer: <img> (original circuit image)
            │
SVG overlay: <svg> (same dimensions, position: absolute)
            ├── Components layer (green rectangles + labels)
            ├── Texts layer (amber rectangles + OCR text)
            ├── Junctions layer (red circles)
            └── Graph layer (purple nodes, edges with component linkage)
```

Each layer can be toggled independently via checkbox controls. The SVG uses the same coordinate system as the original image, ensuring pixel-perfect alignment.

### 5.3 Editable Sidebar

The sidebar provides collapsible `<details>` sections for each data type:

**Components Section:**
```
▼ Components (12)
┌──────────────────────────┐
│ Component #1  [🗑 Delete] │
│ Type: [resistor ▾]       │
│ Value: [10k        ]     │
│ Name:  [R1          ]    │
│ Confidence: 92%          │
├──────────────────────────┤
│ Component #2  [🗑 Delete] │
│ ...                      │
└──────────────────────────┘
```

**OCR Texts Section:**
```
▼ OCR Texts (8)
┌──────────────────────────┐
│ Text #1  [🗑 Delete]      │
│ OCR: [10k          ]     │
│ Confidence: 94%          │
│ BBox: (215, 55, 260, 80) │
└──────────────────────────┘
```

**Junctions Section:**
```
▼ Junctions (3)
┌──────────────────────────┐
│ Junction #1  [🗑 Delete]  │
│ Type: junction            │
│ Position: (310, 210)      │
│ Confidence: 87%           │
└──────────────────────────┘
```

Users can:
- **Edit** component type, value, and name via input fields
- **Delete** incorrectly detected components, texts, or junctions
- **View** confidence percentages and bounding box coordinates
- All changes are sent to the backend's `/finalize` endpoint when confirmed

### 5.4 Threshold Re-Analysis

A threshold slider at the bottom allows real-time re-analysis:

```typescript
// Debounced re-analysis (400ms delay)
const reAnalyze = useMemo(
    () => debounce(async (thresh: number) => {
        const resp = await fetch(`${API}/re-analyze`, {
            method: "POST",
            body: JSON.stringify({ session_id, binary_thresh: thresh })
        });
        // Updates only graph + diagnostic images
    }, 400),
    [session_id]
);
```

**Key insight:** `/re-analyze` skips YOLO detection and OCR — it only re-runs the line detection pipeline with the new threshold. This takes ~200ms instead of ~5s, enabling near-instant feedback.

---

## 6. Step 3: SchematicStep — CircuitJS1 Simulation & Chat

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/frontend_circuit.png" alt="Digital Circuit" width="90%">
</p>
<p align="center"><em>The auto-generated digital circuit rendered in CircuitJS1 (color inverted). This editable schematic is ready for interactive SPICE-level simulation.</em></p>

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/simulatefrontendvdivider.png" alt="Simulation Step" width="90%">
</p>
<p align="center"><em>The Simulate step in action: CircuitJS1 iframe with simulation controls, oscilloscope waveforms, and the AI chat assistant.</em></p>

### 6.1 Layout

```
┌─────────────────────────────────────────────┐
│ [← Back] [▶ Play] [⏸ Pause] [↕ Speed] ...  │  ← Control bar
├─────────────────────────────────────────────┤
│                                             │
│           CircuitJS1 iframe                 │
│       (interactive circuit simulator)       │
│                                             │
│                                     ┌───────┤
│                                     │ 💬    ││  ← Chat FAB
│                                     └───────┤
├─────────────────────────────────────────────┤
│         SimulationScope (waveforms)         │  ← Oscilloscope
└─────────────────────────────────────────────┘
```

### 6.2 Simulation Controls

| Control | Action |
|---|---|
| ▶ Play / ⏸ Pause | `sim.setSimRunning(true/false)` |
| ½× | `sim.setMaxTimeStep(current / 2)` — halve simulation speed |
| 2× | `sim.setMaxTimeStep(current * 2)` — double simulation speed |
| Export .txt | `sim.exportCircuit()` → download as `.txt` file |
| Export SVG | `sim.getCircuitAsSVG()` → download as `.svg` (async via callback) |
| Reset | `sim.importCircuit(originalCjsText)` — reload from original |

### 6.3 Export Formats

**CircuitJS1 text format (.txt):**
```
$ 1 0.000005 10.20027730826997 50 5 43 5e-11
r 192 208 320 208 0 1000
c 320 208 320 336 0 0.00001 0
v 192 336 192 208 0 0 40 5 0 0 0.5
w 320 336 192 336 0
```

**SVG format:** Vector rendering of the circuit as drawn by CircuitJS1 — suitable for reports and publications.

---

## 7. API Communication Layer

### 7.1 Endpoint Details

#### `POST /analyze` — Initial Analysis

```
Request:  FormData { file: Blob, binary_thresh: string, ocr_mode: string }
Response: AnalysisPreview {
    session_id: string,
    image_width: number, image_height: number,
    components: DetectedComponent[],
    texts: DetectedText[],
    junctions: DetectedJunction[],
    graph_nodes: GraphNode[],
    graph_edges: GraphEdge[],
    diagnostic_images: DiagnosticImages,
    annotated_image: string (base64),
    original_image: string (base64)
}
```

**What happens server-side:** YOLO detection → TrOCR OCR → (optionally) Custom CRNN OCR → proximity mapping → line detection pipeline → diagnostic image generation.

#### `POST /re-analyze` — Threshold Adjustment

```
Request:  JSON { session_id: string, binary_thresh: number }
Response: JSON {
    graph: { nodes: GraphNode[], edges: GraphEdge[] },
    images: DiagnosticImages
}
```

**What happens server-side:** Only the line detection pipeline (stages 1–10) is re-run with the new threshold. YOLO and OCR results are cached on the backend using `session_id` as key.

#### `POST /finalize` — Generate Circuit Schema

```
Request:  EditedAnalysis {
    image_width: number, image_height: number,
    components: DetectedComponent[],
    texts: DetectedText[],
    junctions: DetectedJunction[],
    graph_nodes: GraphNode[],
    graph_edges: GraphEdge[]
}
Response: Circuit {
    circuit_id: string,
    components: Component[],
    nodes: Node[],
    connections: Connection[],
    edges: Edge[]
}
```

**What happens server-side:** User-edited data is assembled into the final Circuit schema. Component IDs are generated (R1, C1, D1...), units extracted from values, rotations estimated from bounding box aspect ratios.

#### `POST /export-cjs` — Convert to CircuitJS1 Format

```
Request:  Circuit object
Response: JSON { cjs_text: string }
```

**What happens server-side:** The Circuit schema is converted to CircuitJS1's text format. Each component becomes a line like `r 192 208 320 208 0 1000` (resistor from (192,208) to (320,208) with value 1000). Connections become wire lines `w x1 y1 x2 y2`.

#### `POST /chat` — AI Assistant

```
Request:  JSON {
    circuit: Circuit,
    message: string,
    history: ChatMessage[] (last 6),
    cjs_text: string
}
Response: JSON { reply: string }
```

**What happens server-side:** The circuit is summarized into a text description, combined with the CJS format text and conversation history, then sent to Lightning AI (DeepSeek-V3.1) for a contextual response.

### 7.2 Error Handling

All API calls use standard `fetch()` with:
- `try/catch` around every request
- Error state shown as toast notifications or inline error messages
- Loading states for all async operations (spinner, progress, disabled buttons)

### 7.3 Session Management

The backend assigns a `session_id` on `/analyze`. This ID is used by `/re-analyze` to retrieve cached YOLO/OCR results. Session data is stored in a Python dictionary (`_session_cache`) — not a database. This means sessions are lost on server restart.

---

## 8. Data Flow: End-to-End Pipeline

```
USER                    FRONTEND                      BACKEND (FastAPI)
 │                         │                               │
 │ Drops image             │                               │
 │────────────────────────→│                               │
 │                         │ Client-side threshold preview  │
 │ Adjusts threshold       │ (canvas-based, instant)        │
 │────────────────────────→│                               │
 │                         │                               │
 │ Clicks "Analyze"        │                               │
 │────────────────────────→│ POST /analyze                 │
 │                         │──────────────────────────────→│
 │                         │                               │ YOLO detect
 │                         │                               │ TrOCR OCR
 │                         │                               │ CRNN OCR (if slow mode)
 │                         │                               │ Proximity mapping
 │                         │                               │ Line detection
 │                         │          AnalysisPreview       │
 │                         │←──────────────────────────────│
 │  Shows review screen    │                               │
 │←────────────────────────│                               │
 │                         │                               │
 │ Edits components/text   │                               │
 │────────────────────────→│ (local state update)          │
 │                         │                               │
 │ Adjusts threshold       │                               │
 │────────────────────────→│ POST /re-analyze (debounced)  │
 │                         │──────────────────────────────→│
 │                         │                               │ Re-run line detection only
 │                         │       Updated graph + images   │
 │                         │←──────────────────────────────│
 │  Updated view           │                               │
 │←────────────────────────│                               │
 │                         │                               │
 │ Clicks "Generate"       │                               │
 │────────────────────────→│ POST /finalize                │
 │                         │──────────────────────────────→│
 │                         │                               │ Build Circuit schema
 │                         │           Circuit              │
 │                         │←──────────────────────────────│
 │                         │ POST /export-cjs              │
 │                         │──────────────────────────────→│
 │                         │                               │ Convert to CJS text
 │                         │         { cjs_text }           │
 │                         │←──────────────────────────────│
 │                         │                               │
 │  CircuitJS1 simulator   │ Load cjs_text into iframe     │
 │←────────────────────────│                               │
 │                         │                               │
 │ Types chat message      │                               │
 │────────────────────────→│ POST /chat                   │
 │                         │──────────────────────────────→│
 │                         │                               │ AI generates response
 │                         │       { reply }                │
 │                         │←──────────────────────────────│
 │  Shows AI response      │                               │
 │←────────────────────────│                               │
```

### Data Transformations

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/backend_req_res.png" alt="Backend Request/Response Flow" width="80%">
</p>
<p align="center"><em>Backend request/response data flow showing the transformations at each API call stage.</em></p>

| Stage | Input Type | Output Type | Transformation |
|---|---|---|---|
| Upload → Analyze | `File + threshold + mode` | `AnalysisPreview` | Raw image → ML detections + graph |
| Review → Finalize | `EditedAnalysis` | `Circuit` | User-corrected detections → structured schema |
| Finalize → Export | `Circuit` | `{ cjs_text }` | Schema → CircuitJS1 text format |
| View → Chat | `Circuit + message` | `{ reply }` | Context + question → AI response |

---

## 9. CircuitJS1 Integration — iframe & JS API

### 9.1 What is CircuitJS1?

CircuitJS1 is a **GWT (Google Web Toolkit) compiled** electronic circuit simulator that runs entirely in the browser. Originally a desktop Java application by Paul Falstad, it was ported to JavaScript/HTML5. It provides:

- **Schematic rendering:** Draws circuit components in standard electrical engineering notation
- **SPICE-like simulation:** Real-time nodal analysis solving Kirchhoff's laws
- **Interactive editing:** Users can click, drag, modify circuits in the browser
- **Multiple analysis types:** DC, transient, resistance, capacitance measurements

### 9.2 Static Hosting

CircuitJS1 is built as a static web application and placed in `public/circuitjs/`. The Next.js configuration sets up URL rewrites:

```javascript
// next.config.js
module.exports = {
    async rewrites() {
        return [{
            source: "/circuit/:path*",
            destination: "/circuitjs/:path*"
        }];
    }
};
```

This allows the iframe to load from `/circuitjs/circuitjs.html` while appearing under `/circuit/` URLs.

### 9.3 iframe Embedding

```typescript
<iframe
    ref={iframeRef}
    src={`/circuitjs/circuitjs.html?cct=${encodeURIComponent(cjsText)}`}
    style={{ width: "100%", height: "100%", border: "none" }}
/>
```

The circuit text is passed as a URL query parameter (`?cct=...`) for initial load, then also injected via the JS API after the GWT module initializes.

### 9.4 JS API Bridge

The CircuitJS1 GWT module exposes a JavaScript API on the iframe's `contentWindow`:

```typescript
interface CircuitJSAPI {
    // Simulation control
    setSimRunning(run: boolean): void;
    isRunning(): boolean;
    getTime(): number;                    // Current simulation time (seconds)
    getTimeStep(): number;                // Current timestep size
    getMaxTimeStep(): number;
    setMaxTimeStep(dt: number): void;     // Control speed
    
    // Circuit I/O
    importCircuit(text: string, subcircuitsOnly?: boolean): void;
    exportCircuit(): string;
    getCircuitAsSVG(): void;             // Triggers onsvgrendered callback
    
    // Live data access
    getNodeVoltage(label: string): number;
    setExtVoltage(label: string, v: number): void;
    getElements(): CircuitJSElement[];    // All circuit elements
    
    // Callbacks
    onupdate?: (sim: CircuitJSAPI) => void;     // Each UI frame
    ontimestep?: (sim: CircuitJSAPI) => void;   // Each sim step
    onanalyze?: (sim: CircuitJSAPI) => void;    // After circuit change
    onsvgrendered?: (sim: CircuitJSAPI, svg: string) => void;
}

interface CircuitJSElement {
    getVoltageDiff(): number;
    getCurrent(): number;
    getType(): string;
    getInfo(): string[];
}
```

### 9.5 Initialization Sequence

```typescript
const initCircuitJS = () => {
    const iframe = iframeRef.current;
    const cw = iframe.contentWindow as CircuitJSWindow;
    
    // Check if already loaded
    if (cw.CircuitJS1) {
        const sim = cw.CircuitJS1;
        sim.importCircuit(cjsText);
        sim.setSimRunning(true);
        return;
    }
    
    // Wait for GWT module to load
    cw.oncircuitjsloaded = (sim: CircuitJSAPI) => {
        sim.importCircuit(cjsText);
        sim.setSimRunning(true);
        
        // Register update callback for scope data
        sim.onupdate = (sim) => {
            // Sample element voltages/currents for waveform display
        };
    };
};
```

**Why `oncircuitjsloaded`?** The GWT module loads asynchronously. The iframe's HTML may be ready while the JavaScript module is still compiling. The callback fires when the simulator's Java-to-JS compilation is complete and the API is ready.

---

## 10. SimulationScope — Waveform Rendering

### 10.1 Purpose

The SimulationScope is a **custom canvas-based oscilloscope** that renders live time-series waveforms (voltage and current) for each circuit element during simulation.

### 10.2 Data Collection

```typescript
interface ScopeTrace {
    label: string;         // e.g., "R1 V" or "C1 I"
    data: number[];        // Rolling buffer of samples
    color: string;         // From 10-color palette
    visible: boolean;
}

// On each animation frame:
const sample = () => {
    const elements = sim.getElements();
    elements.forEach((el, i) => {
        traces[i * 2].data.push(el.getVoltageDiff());     // Voltage trace
        traces[i * 2 + 1].data.push(el.getCurrent());     // Current trace
    });
    requestAnimationFrame(sample);
};
```

### 10.3 Canvas Rendering

The scope renders on an HTML5 `<canvas>` element with:

```
┌───────────────────────────────────┐
│ 5V ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  ← Y-axis labels (auto-scaled: µ/m/k)
│        ╱╲    ╱╲    ╱╲            │
│ 0V ─ ╱──╲──╱──╲──╱──╲── ─ ─ ─ ─ │  ← Zero line
│     ╱    ╲╱    ╲╱    ╲           │
│-5V ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  0µs    100µs   200µs   300µs    │  ← X-axis (auto-scaled: µs/ms/s)
├───────────────────────────────────┤
│ ● R1 V  ● C1 V  ● R1 I  ● C1 I │  ← Legend (click to toggle)
└───────────────────────────────────┘
```

**Rendering details:**
- **Background:** Dark (#0d0d1a)
- **Grid lines:** Subtle gray dashed lines
- **Auto-scaling Y-axis:** Automatically adjusts range to fit data; uses SI prefixes (µ, m, k)
- **Auto-scaling X-axis:** Displays time in appropriate units (µs, ms, s)
- **Zero line:** Highlighted reference line
- **Rolling window:** Last 500 data points per trace (configurable via `maxPoints`)

### 10.4 Interactivity

- **Hover legend entries:** Highlights the corresponding trace, dims all others
- **Click legend entries:** Toggle trace visibility
- **Cursor crosshair:** Shows exact voltage/current values at the cursor position
- **10-color palette:** Each element gets two distinct colors (voltage trace + current trace)

---

## 11. AI Chat Integration

### 11.1 UI Design

The chat appears as a **floating window** anchored to the bottom-right of the SchematicStep:

```
                                    ┌──────────────────┐
                                    │ 🤖 Circuit AI  ✕ │
                                    │  [Clear History]  │
                                    ├──────────────────┤
                                    │ User: What does  │
                                    │ this circuit do?  │
                                    │                  │
                                    │ AI: This is an   │
                                    │ RC low-pass      │
                                    │ filter with a    │
                                    │ cutoff of 159Hz. │
                                    ├──────────────────┤
                                    │ Quick prompts:   │
                                    │ [What does this  │
                                    │  circuit do?]    │
                                    │ [Any issues?]    │
                                    │ [Suggest         │
                                    │  improvements]   │
                                    ├──────────────────┤
                                    │ [Type message...]│
                                    │         [Send ➤] │
                                    └──────────────────┘
```

### 11.2 Chat Data Flow

```typescript
const sendChat = async (message: string) => {
    // 1. Add user message to local history
    const newHistory = [...history, { role: "user", content: message }];
    
    // 2. Send to backend with full context
    const response = await fetch(`${API}/chat`, {
        method: "POST",
        body: JSON.stringify({
            circuit: circuit,           // Full Circuit object
            message: message,           // User's question
            history: newHistory.slice(-6), // Last 6 messages
            cjs_text: cjsText           // CircuitJS1 format text
        })
    });
    
    // 3. Add AI response to history
    const { reply } = await response.json();
    setHistory([...newHistory, { role: "assistant", content: reply }]);
};
```

### 11.3 Backend Processing

The chat service (`test/chat_service.py`) processes messages through:

1. **Circuit summarization:** Converts the `Circuit` object into a human-readable text description listing all components with their values, connections, and node structure
2. **System prompt:** Includes the CJS format reference, circuit summary, and instructions for the AI to be a helpful circuit analysis assistant
3. **API call:** Sends the system prompt + conversation history to Lightning AI's DeepSeek-V3.1 model
4. **Response:** Returns markdown-formatted reply

### 11.4 Predefined Quick Prompts

Three quick-start prompts help users who don't know what to ask:

| Prompt | Typical AI Response |
|---|---|
| "What does this circuit do?" | Functional analysis: identifies topology (e.g., "RC low-pass filter"), explains behavior |
| "Any issues?" | Checks for common problems: missing ground, floating nodes, unreasonable values |
| "Suggest improvements" | Recommendations: protection diodes, decoupling caps, better component values |

---

## 12. SVG Overlay System

### 12.1 Architecture

In the "Original + Overlays" review mode, an SVG element is positioned absolutely over the original circuit image:

```html
<div style="position: relative">
    <img src={originalImage} />
    <svg viewBox="0 0 {width} {height}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%">
        <!-- Component overlays -->
        {showComponents && components.map(c => (
            <rect x={c.bbox.x1} y={c.bbox.y1}
                  width={c.bbox.x2 - c.bbox.x1}
                  height={c.bbox.y2 - c.bbox.y1}
                  stroke="green" fill="none" strokeWidth={2} />
            <text x={c.bbox.x1} y={c.bbox.y1 - 4} fill="green">
                {c.name} ({c.confidence}%)
            </text>
        ))}
        
        <!-- Text overlays -->
        <!-- Junction overlays -->
        <!-- Graph edge/node overlays -->
    </svg>
</div>
```

### 12.2 Layer Colors

| Layer | Stroke Color | Rendering |
|---|---|---|
| Components | Green | Rectangles + labels (type, confidence) |
| Texts | Amber/Orange | Rectangles + OCR text |
| Junctions | Red | Circles centered on junction position |
| Graph nodes | Green dots | Small filled circles at node positions |
| Graph edges | Purple/Blue | Lines connecting nodes; components at endpoints shown in colored boxes |

### 12.3 Toggle Controls

```
☑ Components  ☑ Texts  ☑ Junctions  ☑ Graph
```

Each checkbox controls a boolean state that gates the rendering of its SVG layer. This lets users focus on specific aspects of the analysis without visual clutter.

---

## 13. TypeScript Type System

### 13.1 Types File (`types/circuit.ts`)

| Type | Fields | Used For |
|---|---|---|
| `Position` | `{ x, y }` | Component/node positioning |
| `BBox` | `{ x1, y1, x2, y2 }` | Bounding box coordinates |
| `Component` | `id, type, label, value, unit, position, rotation, terminals` | Final schematic component |
| `Node` | `id, position` | Graph node in final circuit |
| `Connection` | Component terminal → node mapping | Wiring information |
| `Edge` | `source, target` (node IDs) | Node-to-node wire |
| `Circuit` | `circuit_id, components[], nodes[], connections[], edges[]` | Complete schematic |
| `DetectedComponent` | `id, cls, type, name, confidence, bbox, position, value, matched_text` | YOLO detection result |
| `DetectedText` | `id, bbox, ocr_text, ocr_confidence` | OCR result |
| `DetectedJunction` | `id, type, bbox, confidence, position` | Junction detection |
| `GraphNode` | `id, x, y` | Skeleton graph vertex |
| `GraphEdge` | `source, target, path?, linked_components?` | Skeleton graph edge |
| `DiagnosticImages` | `skeleton_png, overlay_png, bbox_png, adjacency_graph_png` | Base64 diagnostic PNGs |
| `AnalysisPreview` | Session ID + all detections + images | Full analysis result from `/analyze` |
| `EditedAnalysis` | Image dims + edited detections + graph | User-corrected data for `/finalize` |

### 13.2 Inline Types (in `page.tsx`)

```typescript
interface CircuitJSAPI { ... }        // Simulator API
interface CircuitJSElement { ... }    // Circuit element data
interface CircuitJSWindow extends Window { ... }  // iframe window type
interface ToastItem { ... }           // Notification toast
interface ScopeTrace { ... }          // Waveform data series
```

---

## 14. Standalone Simulate Page

A separate route at `/simulate` (`app/simulate/page.tsx`) provides a stripped-down CircuitJS1 viewer:

```
URL: /simulate?cjs=<encodedCircuitText>
```

**Features:**
- Back button
- Play/Pause toggle
- Halve/Double timestep
- Export .txt and SVG
- Status bar: simulation time, element count, running/paused state

**Use case:** Direct link sharing — a user can share a URL with circuit text embedded in the query parameter, and anyone opening the link gets a simulated view.

---

## 15. File Reference

| File | Role |
|---|---|
| `frontend/app/page.tsx` | Main application page (all 3 steps + orchestrator) |
| `frontend/app/simulate/page.tsx` | Standalone CircuitJS1 viewer page |
| `frontend/types/circuit.ts` | TypeScript type definitions |
| `frontend/next.config.js` | Next.js config with CircuitJS1 rewrites |
| `frontend/package.json` | Dependencies |
| `frontend/tailwind.config.js` | Tailwind CSS configuration |
| `frontend/public/circuitjs/` | Static CircuitJS1 build (GWT-compiled) |
| `test/main.py` | FastAPI backend with all API endpoints |
| `test/schemas.py` | Pydantic models mirroring frontend types |
| `test/chat_service.py` | AI chat backend (Lightning AI / DeepSeek-V3.1) |
| `test/unified_pipeline.py` | Pipeline orchestrator (called by API endpoints) |

---

## 16. Viva Questions & Answers

### Q1: What framework does the frontend use and why?
**A:** Next.js 14 with the App Router, React 18.3, and TypeScript. Next.js provides file-system routing, static asset rewrites (for CircuitJS1), built-in code splitting, and SSR capabilities. React 18.3 offers hooks-based state management and concurrent rendering features. TypeScript adds compile-time type safety to the large data structures passed between frontend and backend.

### Q2: Describe the three-step workflow in the frontend.
**A:** Step 1 (Upload): User drops a circuit image, adjusts binary threshold via a real-time client-side preview, selects OCR mode (fast/slow), and clicks Analyze. Step 2 (Review): User reviews ML detections across 6 view modes, edits component types/values/names, deletes false detections, and adjusts threshold with instant re-analysis. Step 3 (Schematic): The finalized circuit is simulated in CircuitJS1 with play/pause controls, waveform scope, AI chat, and export options.

### Q3: How does the frontend communicate with the backend?
**A:** Via standard HTTP `fetch()` calls to a FastAPI backend. Five endpoints are used: `/analyze` (FormData upload), `/re-analyze` (JSON, threshold only), `/finalize` (JSON, edited detections), `/export-cjs` (JSON, circuit schema), and `/chat` (JSON, chat context). All responses are JSON. The backend is stateless except for a session cache used by `/re-analyze`.

### Q4: How is CircuitJS1 embedded in the frontend?
**A:** CircuitJS1 is served as a static GWT-compiled build from `public/circuitjs/`. It's loaded in an `<iframe>` pointing to `/circuitjs/circuitjs.html`. The initial circuit text is passed via URL query parameter (`?cct=...`). After the GWT module loads (signaled by the `oncircuitjsloaded` callback), the JavaScript API is accessed via `iframe.contentWindow.CircuitJS1` to control simulation, import/export circuits, and read live data.

### Q5: What is the CircuitJS1 JS API and what operations does it support?
**A:** The JS API is exposed on the iframe's `contentWindow` after the GWT module loads. Key operations: `setSimRunning(bool)` for play/pause, `importCircuit(text)` to load circuits, `exportCircuit()` to serialize to text, `getCircuitAsSVG()` for vector export, `getElements()` to access all circuit elements with their voltages and currents, `getNodeVoltage(label)` for specific node readings, and callback hooks (`onupdate`, `ontimestep`, `onanalyze`, `onsvgrendered`) for real-time data streaming.

### Q6: How does the threshold re-analysis work without re-running YOLO and OCR?
**A:** When the user adjusts the threshold slider in the Review step, a debounced (400ms) request is sent to `POST /re-analyze` with the `session_id` and new `binary_thresh` value. The backend retrieves cached YOLO label text and image bytes from `_session_cache` (stored during the initial `/analyze` call) and re-runs only the line detection pipeline (skeletonization + BFS + crossover dissolution). This returns updated graph structure and diagnostic images in ~200ms instead of the full ~5-second pipeline.

### Q7: How does the SVG overlay system work?
**A:** An SVG element with the same dimensions as the original image is positioned absolutely on top of the image element. Bounding boxes, node positions, and edge coordinates from the analysis use the same pixel coordinate system as the image, ensuring perfect alignment. Four toggleable layers (components, texts, junctions, graph) can be independently shown/hidden. Components render as green rectangles, texts as amber rectangles, junctions as red circles, and graph edges as purple lines.

### Q8: How does the AI chat system work end-to-end?
**A:** The user types a message (or picks a Quick Prompt) in the floating chat panel. The frontend sends: the full Circuit object, the message, last 6 conversation messages, and the CircuitJS1 text to `POST /chat`. The backend's chat service summarizes the circuit into a text description, builds a system prompt with CJS format reference, and sends everything to Lightning AI's DeepSeek-V3.1 model. The AI's response is returned as markdown, rendered by `react-markdown` with inverted prose styling.

### Q9: What is the SimulationScope component?
**A:** SimulationScope is a custom canvas-based oscilloscope that renders live waveforms during CircuitJS1 simulation. It auto-discovers circuit elements via `sim.getElements()`, creates voltage and current traces for each element, samples data every animation frame via `requestAnimationFrame`, and renders on an HTML5 canvas with auto-scaling axes, grid lines, a cursor crosshair, and an interactive legend. It maintains a rolling buffer of 500 data points per trace.

### Q10: What client-side processing happens before the image is sent to the backend?
**A:** The image is decoded into a `<canvas>` element, converted to grayscale using ITU-R BT.601 luma coefficients (0.299R + 0.587G + 0.114B), and binary-thresholded at the user's chosen value. This produces a real-time preview of what the backend's thresholding will look like. The preview updates instantly as the user drags the threshold slider, helping them find the optimal value before committing to the slower full analysis.

### Q11: How does data transform from ML detections to CircuitJS1 format?
**A:** Four transformations occur: (1) YOLO outputs bounding boxes + classes → `DetectedComponent[]` and `DetectedText[]` in AnalysisPreview. (2) User edits these in the Review step → `EditedAnalysis`. (3) `/finalize` converts edited data into a structured `Circuit` schema with generated IDs (R1, C1), extracted units, estimated rotations, and node/connection mappings. (4) `/export-cjs` converts the Circuit into CircuitJS1 text format where each component becomes a line like `r x1 y1 x2 y2 0 value` and connections become wire lines `w x1 y1 x2 y2`.

### Q12: What is the role of `session_id` in the API flow?
**A:** `session_id` is a unique identifier generated by the backend on `/analyze`. It keys into `_session_cache`, a Python dictionary that stores the uploaded image bytes and YOLO label text. When `/re-analyze` is called, it uses this ID to retrieve cached data and re-run only the cheap line detection pipeline with updated parameters. This avoids repeating the expensive YOLO (~200ms) and OCR (~500ms) operations on every threshold adjustment.

### Q13: What are the diagnostic images and how are they displayed?
**A:** Four base64-encoded PNG images are generated by the line detection pipeline: (1) `skeleton_png` — cleaned skeleton (1-pixel wire centerlines); (2) `overlay_png` — skeleton with bounding boxes and endpoint markers; (3) `bbox_png` — color-coded detection boxes per class; (4) `adjacency_graph_png` — matplotlib graph visualization with numbered nodes and blue edges. They're displayed in the Review step as view modes (full-size) and in a thumbnail gallery in the sidebar.

### Q14: How does the frontend handle the asynchronous nature of CircuitJS1's SVG export?
**A:** `getCircuitAsSVG()` does not return the SVG directly — it triggers an asynchronous rendering process. The frontend registers a callback via `sim.onsvgrendered = (sim, svg) => { ... }` before calling `getCircuitAsSVG()`. When the GWT module finishes rendering, it invokes the callback with the SVG string, which is then converted to a downloadable Blob URL.

### Q15: How is state managed across the three steps?
**A:** State lives in `WorkspacePage` (the parent) via `useState` hooks: `step` (1/2/3), `preview` (AnalysisPreview from `/analyze`), `circuit` (Circuit from `/finalize`), `cjsText` (string from `/export-cjs`), and `loading` (boolean). These are passed as props to child step components. No external state management library is needed because data flows linearly through 3 stages — each step produces output consumed by the next.

### Q16: How does the frontend ensure pixel-perfect SVG overlay alignment?
**A:** The SVG element uses `viewBox="0 0 {imageWidth} {imageHeight}"` matching the original image's pixel dimensions. It's positioned absolutely over the image with `top: 0; left: 0; width: 100%; height: 100%`. This ensures the SVG's coordinate system maps exactly to the image's pixels. Detection bounding boxes are drawn using the same pixel coordinates returned by the backend, so a box at (120, 45, 210, 95) appears at exactly those pixel positions on the image.

### Q17: What happens if the backend is unreachable?
**A:** All `fetch()` calls are wrapped in `try/catch` blocks. If the backend is unreachable, the error is caught and displayed to the user via toast notifications or inline error messages. The UI remains functional — the user can retry the operation. Loading spinners are properly cleared on error to avoid stuck states.

### Q18: Why is the chat history limited to the last 6 messages?
**A:** The chat backend sends the full context (circuit summary + CJS text + conversation history) to the LLM in a single prompt. Sending too many messages would exceed the model's context window or increase token costs significantly. Six messages (3 exchanges) provides enough conversational continuity for follow-up questions while keeping the prompt size manageable. The full history is maintained on the frontend for display; only the last 6 are sent to the API.

### Q19: How would you deploy this frontend to production?
**A:** (1) Run `next build` to create an optimized production build with code splitting and asset hashing. (2) Set `NEXT_PUBLIC_API_URL` environment variable to the production backend URL. (3) Ensure the CircuitJS1 static build is included in `public/circuitjs/`. (4) Deploy to Vercel (natively supports Next.js) or any Node.js hosting with `next start`. (5) Configure CORS on the FastAPI backend to allow the production frontend origin. (6) Set up HTTPS and CDN for static assets.

### Q20: What are the advantages of using an iframe for CircuitJS1 instead of integrating it directly?
**A:** (1) **Isolation:** CircuitJS1 is a GWT-compiled application with its own global state — iframe isolation prevents conflicts with the React application's DOM and JavaScript. (2) **No build integration needed:** GWT compilation is separate from Next.js's webpack build; the iframe approach avoids complex build tool integration. (3) **Security sandbox:** The iframe can be sandboxed to limit CircuitJS1's access to the parent page. (4) **Easy updates:** CircuitJS1 can be updated independently by replacing the static build files without touching the React code. (5) **Existing JS API:** CircuitJS1 already exposes a well-designed API (`oncircuitjsloaded`, `importCircuit`, etc.) designed for iframe embedding.
