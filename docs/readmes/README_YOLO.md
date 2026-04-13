# YOLOv7 — Object Detection for Circuit Components

## Table of Contents

1. [What is YOLO?](#1-what-is-yolo)
2. [How Does YOLO Work?](#2-how-does-yolo-work)
3. [Why YOLOv7?](#3-why-yolov7)
4. [YOLOv7 Architecture](#4-yolov7-architecture)
5. [Our 15-Class Component Detection Model](#5-our-15-class-component-detection-model)
6. [Training Details](#6-training-details)
7. [Inference Pipeline in CIRCUITRON](#7-inference-pipeline-in-circuitron)
8. [Detection Output Format](#8-detection-output-format)
9. [Post-Detection Classification & Routing](#9-post-detection-classification--routing)
10. [Key Hyperparameters](#10-key-hyperparameters)
11. [Performance Considerations](#11-performance-considerations)
12. [Viva Questions & Answers](#12-viva-questions--answers)

---

## 1. What is YOLO?

**YOLO (You Only Look Once)** is a family of real-time object detection algorithms. Unlike traditional two-stage detectors (e.g., R-CNN, Faster R-CNN) that first propose candidate regions and then classify them, YOLO treats detection as a **single regression problem** — it predicts bounding boxes and class probabilities directly from the full image in **one forward pass** through the neural network.

### Key Principles

- **Single-stage detection:** The image is divided into an S × S grid. Each grid cell predicts B bounding boxes, objectness scores, and C class probabilities simultaneously.
- **Global reasoning:** Because the entire image is seen at once (not just proposed patches), YOLO implicitly encodes contextual information about object classes and appearances across the full image.
- **Real-time speed:** By collapsing region proposal + classification into one network, YOLO achieves inference speeds orders of magnitude faster than two-stage detectors (typically 30–160 FPS depending on version and hardware).

### YOLO vs Two-Stage Detectors

| Property | Two-Stage (Faster R-CNN) | Single-Stage (YOLO) |
|---|---|---|
| Region proposal | Separate RPN | None (grid-based) |
| Forward passes | 2+ per image | 1 per image |
| Speed | ~5 FPS | 30–160 FPS |
| Background error | Lower (RPN filters) | Higher (mitigated in v3+) |
| Global context | Limited (per-patch) | Full image at once |

---

## 2. How Does YOLO Work?

### 2.1 Image Division

The input image is conceptually divided into an **S × S grid** (e.g., 7×7 in YOLOv1, variable in later versions). Each grid cell is responsible for detecting objects whose **center** falls within that cell.

### 2.2 Bounding Box Prediction

Each grid cell predicts **B bounding boxes**. Each bounding box prediction consists of 5 values:

| Value | Description |
|---|---|
| `x` | X-coordinate of box center (relative to grid cell) |
| `y` | Y-coordinate of box center (relative to grid cell) |
| `w` | Width of box (relative to image) |
| `h` | Height of box (relative to image) |
| `confidence` | $P(\text{object}) \times \text{IoU}(\text{pred}, \text{truth})$ |

The **confidence score** represents both the probability that an object exists and how accurate the predicted box is.

### 2.3 Class Prediction

Each grid cell also predicts **C conditional class probabilities**: $P(\text{Class}_i \mid \text{Object})$. At test time, the final class-specific confidence for each box is:

$$P(\text{Class}_i) \times \text{IoU} = P(\text{Class}_i \mid \text{Object}) \times P(\text{Object}) \times \text{IoU}$$

### 2.4 Non-Maximum Suppression (NMS)

Multiple grid cells may predict boxes for the same object. **NMS** removes redundant overlapping detections:

1. Sort all predicted boxes by confidence score (descending).
2. Select the highest-confidence box and add it to the final results.
3. Compute IoU between this box and all remaining boxes.
4. Remove any box with IoU > threshold (default: 0.45–0.7).
5. Repeat from step 2 until no boxes remain.

### 2.5 Anchor Boxes (YOLOv2+)

Starting from YOLOv2, the model uses **anchor boxes** — predefined bounding box shapes (aspect ratios and sizes) determined by k-means clustering on the training dataset. Instead of predicting absolute box coordinates, the network predicts **offsets** from these anchors, making training more stable and convergence faster.

### 2.6 Multi-Scale Detection (YOLOv3+)

From YOLOv3 onward, detection happens at **three different scales** using Feature Pyramid Networks (FPN). The backbone produces feature maps at 3 resolutions (e.g., 13×13, 26×26, 52×52 for 416×416 input):

- **Small feature map (13×13):** Detects large objects
- **Medium feature map (26×26):** Detects medium objects
- **Large feature map (52×52):** Detects small objects

This multi-scale approach is critical for circuit diagrams where component sizes vary dramatically (tiny junction dots vs. large integrated circuits).

---

## 3. Why YOLOv7?

### 3.1 Comparison of Candidate Architectures

| Model | Released | mAP (COCO) | Speed (FPS) | Key Innovation |
|---|---|---|---|---|
| YOLOv5 | 2020 | 50.7% | 140 | PyTorch native, easy to train |
| YOLOv6 | 2022 | 52.5% | 120 | Efficient reparameterized design |
| **YOLOv7** | **2022** | **56.8%** | **120** | **E-ELAN, auxiliary head, reparameterization** |
| YOLOv8 | 2023 | 53.9% | 130 | Anchor-free, unified API |

### 3.2 Reasons for Choosing YOLOv7

1. **State-of-the-art accuracy at the time of project development:** YOLOv7 achieved the highest mAP on COCO among real-time detectors when our model was designed and trained.

2. **Extended-ELAN (E-ELAN) backbone:** An enhanced feature extraction architecture that uses expand-shuffle-merge cardinality to improve learning ability without destroying the gradient path. This is critical for our small dataset where every ounce of representational power matters.

3. **Compound model scaling:** YOLOv7 scales all parts of the network (depth, width, resolution) in a compound manner, ensuring optimal performance at every model size.

4. **Reparameterized convolutions:** During training, certain convolution layers use complex multi-branch structures for better gradient flow. At inference, these are mathematically collapsed into single standard convolutions — training-time accuracy gains with zero inference overhead.

5. **Auxiliary head training:** YOLOv7 trains with both a **lead head** (primary detection head) and **auxiliary heads** at intermediate layers. The auxiliary heads provide additional supervision signals during training (like having extra teachers), but are discarded at inference time — free accuracy boost.

6. **Excellent transfer learning:** Pre-trained on COCO (80 classes, 330K images), YOLOv7 provides rich low-level feature representations (edges, shapes, textures) that transfer extremely well to our circuit component detection domain.

7. **Well-supported training pipeline:** Robust data augmentation (mosaic, mix-up, HSV jitter, scale/translate), automatic anchor calculation, and mature evaluation tools.

### 3.3 Why Not Other Versions?

- **YOLOv5:** Lower accuracy, lacks the advanced training strategies (auxiliary heads, reparameterization) of YOLOv7.
- **YOLOv8:** Was released after our model training began. Also, YOLOv8's anchor-free approach sometimes shows slightly lower accuracy on small-object detection tasks compared to anchor-based YOLOv7.
- **Faster R-CNN / Detectron2:** Too slow for interactive use (our pipeline must respond within seconds). Two-stage detectors are overkill when single-stage achieves sufficient accuracy.
- **SSD (Single Shot MultiBox Detector):** Lower accuracy than YOLO family on small objects; less community support.

---

## 4. YOLOv7 Architecture

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolov7_architecture.png" alt="YOLOv7 Architecture" width="90%">
</p>
<p align="center"><em>YOLOv7 architecture overview: E-ELAN backbone → SPPCSPC + PANet neck → multi-scale detection heads.</em></p>

### 4.1 High-Level Architecture

```
Input Image (640×640)
        │
        ▼
┌───────────────────┐
│   BACKBONE        │
│   (E-ELAN)        │     Feature Extraction
│                   │     
│   CBS → E-ELAN    │     CBS = Conv + BatchNorm + SiLU
│   → E-ELAN → ...  │     
└───────┬───────────┘
        │    Feature maps at multiple resolutions
        ▼
┌───────────────────┐
│   NECK            │
│   (SPPCSPC +      │     Feature Aggregation
│    PANet/FPN)     │
│                   │     SPP  = Spatial Pyramid Pooling
│   Concatenate     │     PANet = Path Aggregation Network
│   features from   │
│   multiple scales │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│   HEAD            │
│   (RepConv +      │     Detection
│    Anchor-Based)  │
│                   │
│   3 detection     │     Detect at 3 scales:
│   heads at        │     P3 (80×80), P4 (40×40), P5 (20×20)
│   different       │
│   scales          │
└───────────────────┘
        │
        ▼
  Predictions: [batch, num_anchors, 5 + num_classes]
  (x, y, w, h, obj_conf, class_probs...)
```

### 4.2 E-ELAN (Extended Efficient Layer Aggregation Network)

E-ELAN is the core innovation of YOLOv7's backbone. It extends the ELAN architecture with a more efficient gradient path:

- **Standard convolution layers** extract features at each stage
- **Expand:** Features are processed through multiple parallel computational blocks
- **Shuffle:** Channel-level feature shuffling ensures information mixing across branches
- **Merge:** Outputs from all branches are concatenated back together

This design ensures that adding more computational blocks (deeper network) does **not** disrupt the original gradient path — deeper layers get stronger gradients without the vanishing gradient problem.

### 4.3 SPPCSPC (Spatial Pyramid Pooling Cross Stage Partial Connection)

The SPPCSPC module sits between the backbone and neck:

1. Input features are split into two branches (Cross Stage Partial pattern)
2. One branch passes through SPP with multiple pooling kernel sizes (5×5, 9×9, 13×13)
3. Multi-scale pooling captures objects at different receptive fields
4. Branches are concatenated and processed by a transition layer

### 4.4 Reparameterized Convolution (RepConv)

During training, each RepConv block contains:
```
Input → 3×3 Conv → BN → │
Input → 1×1 Conv → BN → ├─→ Add → Activation
Input → Identity → BN → │
```

At inference, all three branches are mathematically fused into a single 3×3 convolution:
```
Input → Single Fused 3×3 Conv → Activation
```

This gives the accuracy benefit of multi-branch training with the speed of a single convolution at inference.

### 4.5 Auxiliary Head Training

YOLOv7 introduces **auxiliary heads** attached to intermediate feature maps during training:

```
Backbone → Neck → Lead Head (primary detection, used at inference)
                ↘ Auxiliary Head 1 (extra supervision, discarded at inference)
                ↘ Auxiliary Head 2 (extra supervision, discarded at inference)
```

The auxiliary heads receive "coarse-to-fine" label assignment — they're trained with softer labels that guide the lead head toward better feature representations.

### 4.6 Loss Function

YOLOv7 uses a composite loss:

$$\mathcal{L} = \lambda_{\text{box}} \cdot \mathcal{L}_{\text{box}} + \lambda_{\text{obj}} \cdot \mathcal{L}_{\text{obj}} + \lambda_{\text{cls}} \cdot \mathcal{L}_{\text{cls}}$$

Where:
- $\mathcal{L}_{\text{box}}$: **CIoU loss** (Complete IoU) for bounding box regression — considers overlap, center distance, and aspect ratio
- $\mathcal{L}_{\text{obj}}$: **Binary Cross-Entropy** for objectness confidence
- $\mathcal{L}_{\text{cls}}$: **Binary Cross-Entropy** for class probabilities (multi-label formulation)

---

## 5. Our 15-Class Component Detection Model

### 5.1 Component Classes

The model detects 15 distinct circuit component classes:

| Class ID | Name | Description | Typical Count in a Circuit |
|---|---|---|---|
| 0 | `capacitor` | Capacitor symbols (polarized/unpolarized) | 1–5 |
| 1 | `crossover` | Wire crossover (non-connecting intersection) | 0–3 |
| 2 | `diode` | Diode symbols (standard, Zener, LED) | 1–4 |
| 3 | `gnd` | Ground symbol | 1–2 |
| 4 | `inductor` | Inductor/coil symbols | 0–3 |
| 5 | `integrated_circuit` | IC package (DIP/rectangular) | 0–2 |
| 6 | `junction` | Wire junction (connecting intersection) | 2–10 |
| 7 | `operational_amplifier` | Op-amp triangle symbol | 0–2 |
| 8 | `resistor` | Resistor symbols (zigzag/rectangular) | 2–10 |
| 9 | `switch` | Switch symbols | 0–3 |
| 10 | `terminal` | Input/output terminal points | 1–4 |
| 11 | `text` | Component value labels (e.g., "10k", "5V") | 3–15 |
| 12 | `transistor` | BJT/MOSFET symbols | 0–4 |
| 13 | `voltage` | Voltage source symbols | 1–3 |
| 14 | `vss` | Negative supply / ground reference | 0–2 |

### 5.2 Class Distribution Challenges

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/retrained_yolov7_result1.png" alt="YOLOv7 Detection Example 1" width="80%">
</p>
<p align="center"><em>YOLOv7 detection result (i): The model successfully detects and classifies all components with high confidence.</em></p>

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/retrained_yolov7_result2.png" alt="YOLOv7 Detection Example 2" width="80%">
</p>
<p align="center"><em>YOLOv7 detection result (ii): Another test image showing robust detection across different component classes.</em></p>

Circuit diagrams pose unique detection challenges:

- **Extreme size variation:** A junction dot may be 8×8 pixels while an IC can span 200×150 pixels. YOLOv7's multi-scale detection heads (P3, P4, P5) are essential for handling this range.
- **High inter-class similarity:** A resistor (zigzag) and inductor (coil) differ only in line curvature. The model must learn subtle shape discriminators.
- **Text as a class:** Detecting text regions is a non-standard YOLO task. The model learns to identify character clusters as "text" bounding regions, which are then passed to OCR.
- **Crossover vs. Junction:** Visually almost identical (small intersection of lines). The model must distinguish based on subtle geometric cues (crossover has a small arc or gap in one wire).

### 5.3 Pipeline Role Classification

After detection, the 15 classes are routed to different pipeline stages:

```
YOLO Detections (15 classes)
        │
        ├── cls 11 (text) ──────────────────► OCR Engine (TrOCR / CRNN)
        │
        ├── cls 0,2,3,4,5,7,8,9,12,13,14 ──► Component Processing
        │   (resistor, capacitor, etc.)         + Proximity Mapping
        │
        └── cls 1,6,10 ────────────────────► Junction/Crossover Processing
            (crossover, junction, terminal)     + Crossover Dissolution
```

This routing is performed in `unified_pipeline.py`:

```python
text_boxes = [d for d in all_detections if d["name"] == "text"]
junction_dets = [d for d in all_detections if d["name"] in ("junction", "crossover", "terminal")]
component_dets = [d for d in all_detections if d["name"] not in ("text", "junction", "crossover", "terminal")]
```

---

## 6. Training Details

### 6.1 Dataset Preparation

- **Annotation format:** YOLO txt format — one `.txt` file per image, each line: `class xc yc w h` (normalized 0–1)
- **Images:** Hand-drawn circuit diagrams on paper, photographed and digitized
- **Augmentations applied during training:**
  - **Mosaic:** 4 images combined into one — forces the model to detect objects at different scales and contexts
  - **Mix-up:** Two images blended with alpha transparency — regularization technique
  - **HSV jitter:** Random adjustments to hue, saturation, value — handles varying photograph lighting
  - **Random affine:** Scale, translate, rotate, shear — simulates camera angle variations
  - **Flip:** Horizontal flip with 50% probability

### 6.2 Model Weights

- **Pretrained backbone:** COCO-pretrained YOLOv7 weights (transfer learning)
- **Fine-tuned weights:** `yolov7new/best.pt` — the final checkpoint after training on our circuit diagram dataset
- **Framework:** Ultralytics YOLO (Python wrapper over PyTorch)

### 6.3 Input Resolution

- **Training & inference:** `640 × 640` pixels
- Images are letterbox-resized (padded to maintain aspect ratio)

---

## 7. Inference Pipeline in CIRCUITRON

### 7.1 Model Loading (Lazy Singleton)

The model is loaded **once** on the first inference call and reused for all subsequent requests:

```python
_model: YOLO | None = None

def _load_model(weights: str = _DEFAULT_WEIGHTS):
    global _model
    _model = YOLO(weights)
```

**Default weights path:** `Codes/yolov7new/best.pt`

### 7.2 Detection Flow (`detect()`)

```python
def detect(image_bytes, *, weights=None, img_size=640, conf_thres=0.2, iou_thres=0.7, _decoded_bgr=None) -> str:
```

**Steps:**

1. **Lazy model loading:** If `_model` is `None`, load from disk.
2. **Image decoding:** Convert raw bytes to BGR numpy array via `cv2.imdecode`. If a pre-decoded image is provided (`_decoded_bgr`), skip decoding to avoid redundant work.
3. **Record original dimensions:** `(orig_h, orig_w)` for coordinate denormalization later.
4. **Run inference:** `_model.predict(source=im0, imgsz=640, conf=0.2, iou=0.7, ...)`
5. **Format results:** Convert each detection from pixel coordinates back to normalized `(xc, yc, w, h)` format with confidence.

**Output format:** Multi-line string, one detection per line:
```
class_id xc yc w h confidence
```
Example:
```
8 0.421875 0.312500 0.140625 0.078125 0.923456
11 0.600000 0.293750 0.112500 0.037500 0.876543
```

### 7.3 Parsed Detection Flow (`detect_parsed()`)

```python
def detect_parsed(image_bytes, ...) -> tuple[List[Dict], int, int]:
```

A higher-level wrapper that:
1. Decodes the image to get pixel dimensions
2. Calls `detect()` to get the label text
3. Calls `parse_label_text()` to convert to structured dicts

**Returns:** `(detections, img_w, img_h)` where each detection is:
```python
{
    "cls": 8,
    "name": "resistor",
    "confidence": 0.923456,
    "bbox": [x1, y1, x2, y2]  # pixel coordinates
}
```

### 7.4 Label Text Parser (`parse_label_text()`)

Converts the string output back to pixel-space bounding boxes:

```python
cx = xc * img_w        # denormalize center x
cy = yc * img_h        # denormalize center y
w = bw * img_w          # denormalize width
h = bh * img_h          # denormalize height
x1 = int(round(cx - w / 2))   # top-left x
y1 = int(round(cy - h / 2))   # top-left y
x2 = int(round(cx + w / 2))   # bottom-right x
y2 = int(round(cy + h / 2))   # bottom-right y
```

---

## 8. Detection Output Format

### Normalized Format (YOLO standard)

```
class_id  x_center  y_center  width  height  confidence
   8      0.421875  0.312500  0.1406 0.0781  0.923456
```

All coordinates are normalized to `[0, 1]` relative to the image dimensions.

### Parsed Format (Pixel coordinates)

```json
{
    "cls": 8,
    "name": "resistor",
    "confidence": 0.923,
    "bbox": [245, 175, 335, 225]
}
```

`bbox` is in `[x1, y1, x2, y2]` format (top-left and bottom-right corners in pixels).

---

## 9. Post-Detection Classification & Routing

After YOLO detection, components are categorized into three groups for downstream processing:

### Group 1: Text Regions → OCR
- **Classes:** `text` (11)
- **Processing:** Sent to TrOCR or CRNN for character recognition
- **Purpose:** Extract component values like "10k", "4.7uF", "5V"

### Group 2: Active Components → Proximity Mapping
- **Classes:** `capacitor` (0), `diode` (2), `gnd` (3), `inductor` (4), `integrated_circuit` (5), `operational_amplifier` (7), `resistor` (8), `switch` (9), `transistor` (12), `voltage` (13), `vss` (14)
- **Processing:** Each component gets a SPICE-style ID (R1, C2, V3...) and is matched with the nearest OCR text via proximity mapping
- **Purpose:** Associate detected values with their parent components

### Group 3: Topological Elements → Line Detection
- **Classes:** `crossover` (1), `junction` (6), `terminal` (10)
- **Processing:** Used as graph nodes in the skeleton-based wire tracing
- **Purpose:** Determine wire connectivity topology

---

## 10. Key Hyperparameters

### Inference Parameters

| Parameter | Default | Description |
|---|---|---|
| `img_size` | 640 | Input resolution (pixels). Larger = more accurate but slower |
| `conf_thres` | 0.2 / 0.25 | Minimum confidence to keep a detection. Lower catches more but increases false positives |
| `iou_thres` | 0.7 / 0.45 | IoU threshold for NMS. Higher keeps more overlapping boxes |

### Why Different Thresholds?

The `detect()` function uses `conf_thres=0.2` (more permissive) because the downstream pipeline can filter false positives using contextual information. The `detect_parsed()` function uses `conf_thres=0.25` for a slightly stricter initial filter when used for direct API output.

---

## 11. Performance Considerations

### Speed Optimization

1. **Lazy loading:** The model is loaded once and cached as a module-level global. Subsequent calls reuse the loaded model.
2. **Pre-decoded image reuse:** The `_decoded_bgr` parameter allows upstream code that already decoded the image to pass it directly, avoiding double-decoding.
3. **GPU acceleration:** If CUDA is available, the ultralytics framework automatically uses GPU inference.
4. **Inference-only mode:** The model runs with `verbose=False` and `save=False` to minimize I/O overhead.

### Memory Usage

- **Model size:** ~37MB (YOLOv7 weights `best.pt`)
- **GPU memory:** ~200–400MB at inference time (depending on batch size and image resolution)
- **CPU fallback:** Fully functional on CPU, just slower (~1–3 seconds per image vs. ~50ms on GPU)

---

## 12. Viva Questions & Answers

### Q1: What is YOLO and how does it differ from Faster R-CNN?
**A:** YOLO (You Only Look Once) is a single-stage object detector that predicts bounding boxes and class probabilities in one forward pass through the network. Faster R-CNN is a two-stage detector that first generates region proposals (RPN) and then classifies each proposal. YOLO is significantly faster because it processes the entire image as a single regression problem, while Faster R-CNN processes thousands of candidate regions individually. However, YOLO can have higher background error rates, which modern versions (v3+) mitigate with multi-scale detection.

### Q2: Why did you choose YOLOv7 over YOLOv5 or YOLOv8?
**A:** YOLOv7 was selected because it offered the highest accuracy (56.8% mAP on COCO) among real-time detectors at the time of our project's development. Its key innovations — E-ELAN backbone for better gradient flow, reparameterized convolutions for free inference speed, and auxiliary head training for extra supervision — all contributed to better detection especially on our small custom dataset. YOLOv5 lacked these advanced training strategies. YOLOv8 was released after our training began and uses an anchor-free approach that can be slightly less accurate for small objects like junction dots.

### Q3: What is Non-Maximum Suppression (NMS) and why is it needed?
**A:** NMS is a post-processing step that eliminates redundant overlapping detections. Multiple grid cells or anchor boxes may predict bounding boxes for the same object. NMS works by keeping the highest-confidence detection and removing all other detections that overlap with it above an IoU threshold (we use 0.7). Without NMS, a single resistor might produce 3–5 overlapping boxes.

### Q4: What is IoU (Intersection over Union)?
**A:** IoU measures the overlap between two bounding boxes. It's calculated as:
$$\text{IoU} = \frac{\text{Area of Intersection}}{\text{Area of Union}}$$
An IoU of 1.0 means perfect overlap; 0.0 means no overlap. In object detection, IoU is used both for evaluating model accuracy (comparing predicted vs. ground truth boxes) and for NMS filtering.

### Q5: What are anchor boxes and why are they used?
**A:** Anchor boxes are predefined bounding box templates with different aspect ratios and sizes, determined by k-means clustering on the training dataset. Instead of predicting absolute coordinates (which is numerically unstable), the network predicts small offsets from these anchors (e.g., "shift this 3:1 aspect-ratio anchor 5 pixels right and make it 10% taller"). This makes the regression problem easier to learn and converge.

### Q6: How does multi-scale detection work in YOLOv7?
**A:** YOLOv7 detects objects at three scales using feature maps from different depths of the network. Small feature maps (20×20) have large receptive fields and detect big objects (ICs, op-amps). Medium feature maps (40×40) handle medium objects (resistors, capacitors). Large feature maps (80×80) have fine resolution and detect tiny objects (junction dots, text). The Feature Pyramid Network (FPN) and Path Aggregation Network (PANet) combine information across scales.

### Q7: What is transfer learning and how did you use it?
**A:** Transfer learning reuses a model pre-trained on a large dataset (COCO, 330K images, 80 classes) as the starting point for a smaller task-specific dataset. The pre-trained model already learned general visual features (edges, textures, shapes). We froze the early backbone layers and fine-tuned the later layers and detection heads on our circuit diagram dataset. This dramatically reduces the amount of training data needed and prevents overfitting.

### Q8: What is E-ELAN and why is it important for YOLOv7?
**A:** E-ELAN (Extended Efficient Layer Aggregation Network) is YOLOv7's backbone architecture. It uses an expand-shuffle-merge cardinality approach where features flow through multiple parallel computational blocks. The key innovation is that adding more blocks doesn't disrupt the original gradient path. This solves the problem of deeper networks having vanishing gradients. For our task, this means the network can learn more complex feature representations (like the difference between a resistor zigzag and an inductor coil) without degrading training stability.

### Q9: What is reparameterization in YOLOv7?
**A:** Reparameterization is a technique where complex multi-branch convolution blocks used during training (3×3 conv + 1×1 conv + identity shortcut) are mathematically fused into a single equivalent 3×3 convolution at inference time. During training, the multiple branches provide richer gradient information for better learning. At inference, the fused single convolution is computationally cheaper. This gives a free accuracy boost with zero inference cost.

### Q10: How do you handle the varying sizes of circuit components?
**A:** We handle size variation through YOLOv7's multi-scale detection architecture. The model produces feature maps at three resolutions (P3, P4, P5). Small junction dots (8×8 px) are detected by the P3 head with the highest spatial resolution. Large IC packages (200×150 px) are detected by the P5 head with the largest receptive field. Additionally, the training augmentations include random scaling (0.5×–1.5×) which teaches the model to handle objects at different sizes.

### Q11: What happens when the model detects a component with low confidence?
**A:** Our pipeline uses a relatively low confidence threshold of 0.2 to catch as many components as possible. Any detection above 0.2 is kept and passed downstream. The confidence score is preserved in the output alongside each detection. In the frontend review step, users can see each detection's confidence and manually remove false positives before finalizing the schematic. This two-step approach (low threshold + human review) maximizes recall without sacrificing precision.

### Q12: What is CIoU loss and why is it better than standard IoU loss?
**A:** CIoU (Complete IoU) loss improves upon standard IoU loss by considering three geometric factors: (1) overlap area (like standard IoU), (2) normalized distance between predicted and ground truth box centers, and (3) aspect ratio consistency. Standard IoU loss has a zero gradient when boxes don't overlap, making it hard to learn. CIoU always provides a meaningful gradient signal, even for non-overlapping boxes, leading to faster and more accurate bounding box regression.

### Q13: How does the model handle overlapping components in a dense circuit?
**A:** The IoU threshold for NMS (set to 0.7) allows some overlap between detections of different classes. For example, a text label "10k" sitting right next to its resistor will have overlapping bounding boxes, but since they're different classes, both are kept. Within the same class, NMS removes duplicates. Additionally, the downstream proximity mapper handles the association between overlapping text and component detections.

### Q14: What is the input image resolution and why 640×640?
**A:** The input resolution is 640×640 pixels. This is a balance between accuracy and speed. Higher resolutions (1280×1280) would detect smaller objects better but require 4× the computation. Lower resolutions (320×320) would be faster but miss small junction dots. 640×640 provides sufficient resolution to detect all 15 component classes while maintaining interactive response times (~50ms on GPU, ~1–3s on CPU).

### Q15: What is mosaic augmentation and how does it help?
**A:** Mosaic augmentation combines 4 training images into a single mosaic tile by placing them in a 2×2 grid with random cropping. This means each training iteration shows the model components at 4 different scales and contexts simultaneously, effectively quadrupling the batch diversity. It's especially useful for our dataset where circuit diagrams have consistent backgrounds — mosaic forces the model to focus on component features rather than background patterns.

### Q16: What is the role of BatchNorm in the network?
**A:** Batch Normalization normalizes the activations of each layer across the mini-batch, centering them around zero with unit variance. This stabilizes training by preventing internal covariate shift (where the distribution of each layer's inputs changes during training). In YOLOv7, every convolution layer is followed by BatchNorm and SiLU activation (CBS block). At inference time, BatchNorm parameters are frozen and folded into the convolution weights for efficiency.

### Q17: What is SiLU activation and why is it used over ReLU?
**A:** SiLU (Sigmoid Linear Unit), also called Swish, is defined as $f(x) = x \cdot \sigma(x)$ where $\sigma$ is the sigmoid function. Unlike ReLU which has a hard zero for negative values (dying ReLU problem), SiLU is smooth and non-monotonic — slightly negative inputs produce small negative outputs rather than exactly zero. This allows gradient flow for negative activations, improving training stability and final accuracy. YOLOv7 uses SiLU throughout.

### Q18: How do you evaluate YOLO model performance?

Below are the key performance visualizations from training and evaluation:

#### Training & Validation Loss (15-Class)

| Training Loss | Validation Loss |
|---|---|
| <img src="../circuitron_final_report/src/images/figures/yolo_15class_train_loss.png" alt="Training Loss" width="450"> | <img src="../circuitron_final_report/src/images/figures/yolo_15class_val_loss.png" alt="Validation Loss" width="450"> |

<p align="center"><em>Training and validation loss curves (box, classification, DFL) for YOLOv7, YOLOv8, YOLOv11, and YOLOv26 on the 15-class dataset.</em></p>

#### Performance Metrics Over Training

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolo_15class_training_curves.png" alt="Training Curves" width="85%">
</p>
<p align="center"><em>Precision, Recall, mAP@0.5, and mAP@0.5:0.95 across 100 epochs for all four architectures.</em></p>

#### Final Performance Comparison

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolo_15class_final_bar.png" alt="Final Performance Bar Chart" width="80%">
</p>
<p align="center"><em>Final-epoch performance comparison: YOLOv7 (retrained) leads across all metrics.</em></p>

#### Confusion Matrix (Retrained YOLOv7)

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/confusion_matrix_retrained_yolov7.png" alt="Confusion Matrix" width="70%">
</p>
<p align="center"><em>Confusion matrix for the retrained YOLOv7 (15 classes). Dark diagonal = strong class separability; light off-diagonals = minimal inter-class confusion.</em></p>

#### Impact of Class Taxonomy Consolidation (61 → 15 Classes)

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolo_class_impact.png" alt="Class Impact" width="75%">
</p>
<p align="center"><em>Effect of consolidating 61 classes into 15: precision +4.8%, recall +19.9%, mAP@0.5 +15.2%, mAP@0.5:0.95 +21.1%.</em></p>

#### Holistic Comparison Across All Configurations

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolo_full_comparison_bar.png" alt="Full Comparison" width="85%">
</p>
<p align="center"><em>Grouped bar chart comparing all six detection configurations (5 architectures × 2 class taxonomies).</em></p>

#### Performance Evolution Timeline

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolo_evolution_timeline.png" alt="Evolution Timeline" width="85%">
</p>
<p align="center"><em>Performance evolution across the project: from YOLOv5 (61-class, 0.61 mAP) to YOLOv7 retrained (15-class, 0.9562 mAP) — a cumulative 56.8% improvement.</em></p>

#### Radar Chart — Top 3 Models

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/yolo_radar_comparison.png" alt="Radar Comparison" width="55%">
</p>
<p align="center"><em>Radar chart of the three best configurations. The retrained YOLOv7 (15-class) covers the most area across all four performance axes.</em></p>

**A:** Primary metrics: (1) **mAP@0.5** — mean Average Precision at IoU threshold 0.5, measures detection accuracy averaged across all classes. (2) **mAP@0.5:0.95** — mAP averaged across IoU thresholds from 0.5 to 0.95, a stricter metric. (3) **Precision** — fraction of detections that are correct. (4) **Recall** — fraction of ground truth objects that are detected. (5) **F1 score** — harmonic mean of precision and recall. We also evaluate per-class AP to identify weak classes (e.g., crossover vs. junction confusion).

### Q19: What data format does YOLO use for annotations?
**A:** YOLO uses a simple text format: one `.txt` file per image, with one detection per line. Each line contains: `class_id x_center y_center width height`. All coordinates are normalized to [0, 1] relative to the image width and height. For example, `8 0.42 0.31 0.14 0.08` means class 8 (resistor), centered at 42% from left edge and 31% from top, spanning 14% of image width and 8% of image height.

### Q20: What would you do differently if you had more training data?
**A:** With more data: (1) Train a larger YOLOv7 variant (YOLOv7-X or YOLOv7-W6) which has more parameters and can learn more complex representations. (2) Increase input resolution to 1280×1280 for better small-object detection. (3) Train for more epochs without overfitting risk. (4) Potentially add more fine-grained classes (polarized vs. unpolarized capacitor, NPN vs. PNP transistor). (5) Use hard negative mining to specifically improve crossover vs. junction discrimination.
