# TrOCR & Custom CRNN OCR — Text Recognition for Circuit Components

## Table of Contents

1. [What is OCR and Why Do We Need It?](#1-what-is-ocr-and-why-do-we-need-it)
2. [OCR Architecture Overview in CIRCUITRON](#2-ocr-architecture-overview-in-circuitron)
3. [TrOCR — Transformer-Based OCR](#3-trocr--transformer-based-ocr)
4. [Custom CRNN — Fast Lightweight OCR](#4-custom-crnn--fast-lightweight-ocr)
5. [OCR Mode Selection](#5-ocr-mode-selection)
6. [Text Extraction Pipeline](#6-text-extraction-pipeline)
7. [Confidence Scoring](#7-confidence-scoring)
8. [Character Set & Domain-Specific Considerations](#8-character-set--domain-specific-considerations)
9. [Preprocessing Pipeline](#9-preprocessing-pipeline)
10. [Training Details](#10-training-details)
11. [File Reference](#11-file-reference)
12. [Viva Questions & Answers](#12-viva-questions--answers)

---

## 1. What is OCR and Why Do We Need It?

**OCR (Optical Character Recognition)** is the technology that converts images of text into machine-readable character strings. In CIRCUITRON, after YOLO detects bounding boxes around text labels in hand-drawn circuit diagrams, OCR reads those labels to extract component values like "10k", "4.7uF", "100Ω", or "5V".

### Why OCR is Critical

Without OCR, we would know *where* each resistor, capacitor, or voltage source is, but not *what value* it has. The OCR step transforms a visual detection into a **functionally complete** circuit description suitable for simulation in CircuitJS1.

### Domain Challenges

Circuit text is unlike standard document text:

| Challenge | Example | Why It's Hard |
|---|---|---|
| Mixed alphanumeric | `4.7uF`, `10k`, `100Ω` | Numbers and letters intermixed with special characters |
| Engineering units | `µF`, `kΩ`, `mH` | Greek letters (µ, Ω) and SI prefixes |
| Very short strings | `5V`, `1k` | Only 2–3 characters; no language-model cue |
| Handwriting variation | Each person writes "k" differently | High intra-class variance |
| Small crop sizes | Text labels may be 30×10 pixels | Low resolution after cropping from full image |
| Background noise | Pencil smudges, grid lines | Non-uniform backgrounds |

---

## 2. OCR Architecture Overview in CIRCUITRON

CIRCUITRON provides **two OCR engines** that share the same API interface but differ in accuracy and speed:

```
                    YOLO Text Detections (class 11)
                              │
                              ▼
                    ┌─────────────────────┐
                    │  OCR Mode Selection │
                    │                     │
                    │  "fast"  │  "slow"  │
                    └────┬─────┴────┬─────┘
                         │          │
                         ▼          ▼
               ┌──────────────┐  ┌──────────────┐
               │  Custom CRNN │  │  TrOCR        │
               │  (VGG +      │  │  (ViT +       │
               │   BiLSTM +   │  │   GPT-2       │
               │   CTC)       │  │   Decoder)    │
               │              │  │               │
               │  ~5ms/crop   │  │  ~50ms/crop   │
               │  Lightweight │  │  High accuracy │
               └──────┬───────┘  └──────┬────────┘
                      │                 │
                      ▼                 ▼
              { ocr_text: "10k", ocr_confidence: 0.95 }
```

### Comparison

| Property | Custom CRNN (fast) | TrOCR (slow/accurate) |
|---|---|---|
| Architecture | VGG + BiLSTM + CTC | ViT Encoder + GPT-2 Decoder |
| Parameters | ~2M | ~60M |
| Inference speed | ~5ms per crop | ~50ms per crop |
| Batch support | Sequential per crop | Full batch in single forward pass |
| Model size | ~8MB (`crnn_last (1).pth`) | ~240MB (`checkpoint-epoch-2/`) |
| Device | CPU or CUDA | CPU or CUDA (float16 on GPU) |
| Accuracy | Good for clear text | Better for ambiguous/noisy text |
| Character set | 90 chars incl. Ω, µ, × | Full tokenizer vocabulary |

---

## 3. TrOCR — Transformer-Based OCR

### 3.1 What is TrOCR?

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/trocr.png" alt="TrOCR Architecture" width="80%">
</p>
<p align="center"><em>TrOCR architecture: A Vision Transformer (ViT) encoder processes image patches, producing contextual feature vectors that a GPT-2 decoder autoregressively converts into text.</em></p>

**TrOCR (Transformer-based Optical Character Recognition)** is a model from Microsoft that uses a **Vision Transformer (ViT)** as the image encoder and a **GPT-2 language model** as the text decoder. It was introduced in the paper "TrOCR: Transformer-based Optical Character Recognition with Pre-trained Models" (2021).

### 3.2 Architecture

```
Input Image Crop (e.g., "10kΩ")
        │
        ▼
┌───────────────────────┐
│   Vision Transformer  │     ENCODER
│   (ViT / DeiT)       │
│                       │
│   1. Patch embedding  │     Split 384×384 image into 16×16 patches
│      (16×16 patches)  │     = 576 patch tokens
│                       │
│   2. Position embed   │     Add learnable position embeddings
│                       │
│   3. Transformer      │     12 transformer encoder layers
│      encoder layers   │     (self-attention + FFN)
│                       │
│   Output: visual      │     Sequence of 576 contextualized
│   feature sequence    │     feature vectors (dim=384)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│   GPT-2 Decoder       │     DECODER
│   (Autoregressive)    │
│                       │
│   1. Cross-attention  │     Attend to encoder's visual features
│      to encoder       │
│                       │
│   2. Self-attention   │     Attend to previously generated tokens
│      (causal mask)    │
│                       │
│   3. Token prediction │     Predict next character token
│      (vocabulary)     │     
│                       │
│   4. Repeat until     │     Generate until <EOS> or max_length
│      <EOS> token      │
└───────────┬───────────┘
            │
            ▼
    Output: "10kΩ"
```

### 3.3 Vision Transformer Encoder — How It Works

The Vision Transformer (ViT) treats an image as a sequence of patches, analogous to how NLP transformers treat text as a sequence of tokens:

1. **Patch embedding:** The input image (resized to 384×384) is divided into non-overlapping 16×16 pixel patches. Each patch is flattened into a 768-dimensional vector via a linear projection. This produces 576 patch tokens (24×24 grid).

2. **Position embedding:** Learnable position embeddings are added to each patch token so the model knows the spatial arrangement of patches. A special `[CLS]` token is prepended.

3. **Transformer encoder:** 12 layers of multi-head self-attention + feed-forward network. Each patch token can attend to every other patch token, building a rich contextual representation of the entire image.

#### Self-Attention Mechanism

For each patch token, self-attention computes:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right) V$$

Where:
- $Q = XW_Q$ (queries), $K = XW_K$ (keys), $V = XW_V$ (values)
- $d_k$ is the dimension of keys
- The softmax produces attention weights that determine how much each patch should "look at" every other patch

### 3.4 GPT-2 Decoder — How It Works

The decoder is a **causal (autoregressive) transformer** that generates text one token at a time:

1. **Start with `<BOS>` (begin of sequence) token**
2. **Cross-attention:** The decoder attends to the encoder's 576 visual feature vectors to "look at" the image
3. **Self-attention (causal):** The decoder attends to all previously generated tokens (masked so future tokens can't be seen)
4. **Predict next token:** A linear layer + softmax over the vocabulary produces probabilities for the next character
5. **Greedy decoding:** Select the highest-probability token
6. **Repeat** until `<EOS>` token is generated or `max_new_tokens` is reached

### 3.5 Fine-Tuning for Circuit Text

Our TrOCR model was **fine-tuned** from the `microsoft/trocr-small-printed` base checkpoint:

- **Base model:** Pre-trained on printed text (Synthetic data + IAM handwriting dataset)
- **Fine-tuning data:** Cropped text regions from hand-drawn circuit diagrams with ground-truth labels
- **Checkpoint used:** `OCRmodel/trocrfinetuned/checkpoint-epoch-2/`
- **Why epoch 2?** Early stopping — accuracy plateaued after 2 epochs; further training would overfit

### 3.6 Implementation: `OCRService` Class

**File:** `test/ocr_service.py`

```python
class OCRService:
    def __init__(self, model_id=_DEFAULT_MODEL_ID, device=None):
        self._model_id = model_id
        self._device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._processor = None  # TrOCRProcessor (image preprocessing + tokenization)
        self._model = None      # VisionEncoderDecoderModel (ViT + GPT-2)
```

**Key design decisions:**

1. **Lazy loading:** Model loads only on first call (`_ensure_loaded()`), not at import time
2. **Float16 on GPU:** `self._model.half()` — uses half-precision floating point on CUDA for ~2× faster inference with negligible accuracy loss
3. **`max_new_tokens = 16`:** Circuit text labels are short (e.g., "10kΩ" = 4 chars). No need for 32+ tokens like document OCR.
4. **Singleton pattern:** `get_ocr_service()` returns a global instance

### 3.7 Single Image Recognition

```python
def recognise(self, pil_image: Image.Image) -> tuple[str, float]:
```

1. Preprocess image via `TrOCRProcessor` → pixel values tensor
2. Convert to float16 on GPU (if available)
3. Generate tokens with `model.generate(max_new_tokens=16, output_scores=True)`
4. Decode token IDs to string
5. Compute confidence from mean token log-probabilities
6. Return `(text, confidence)`

### 3.8 Batch Recognition

```python
def _recognise_batch(self, pil_images: List[Image.Image]) -> List[tuple[str, float]]:
```

Processes **all text crops from one image in a single GPU forward pass**:

1. Stack all image crops into a single batch tensor (with padding for different sizes)
2. Run one `model.generate()` call for the entire batch
3. Decode all sequences at once
4. Compute per-sample confidence scores

**Why batching matters:** For a circuit image with 10 text labels, batched inference runs ~5× faster than calling `recognise()` 10 times, because GPU parallelism is fully utilized.

### 3.9 Full Extraction Pipeline

```python
def extract_texts(self, image_bgr: np.ndarray, text_boxes: List[Dict]) -> List[Dict]:
```

This is the main API called by the unified pipeline:

1. For each text bounding box, crop the region from the full BGR image
2. Convert BGR crop to RGB PIL Image
3. Collect all valid crops into a batch
4. Call `_recognise_batch()` for single-pass inference
5. Return enriched dicts with `ocr_text` and `ocr_confidence`

```python
# Input:  [{"bbox": [100, 50, 180, 80], ...}, ...]
# Output: [{"bbox": [100, 50, 180, 80], "ocr_text": "10k", "ocr_confidence": 0.94}, ...]
```

---

## 4. Custom CRNN — Fast Lightweight OCR

### 4.1 What is CRNN?

**CRNN (Convolutional Recurrent Neural Network)** is a text recognition architecture that combines:

1. **CNN** for visual feature extraction (what patterns are in the image?)
2. **RNN** for sequence modeling (what order are the characters in?)
3. **CTC** for alignment-free decoding (map variable-length features to variable-length text)

### 4.2 Architecture

```
Input: Grayscale image crop (W × 32 pixels)
        │
        ▼
┌───────────────────────────────┐
│   VGG Feature Extractor       │
│   (Convolutional Backbone)    │
│                               │
│   Conv(1→32)→ReLU→MaxPool     │     Stage 1: 32 filters
│   Conv(32→64)→ReLU→MaxPool    │     Stage 2: 64 filters
│   Conv(64→128)→ReLU           │     Stage 3: 128 filters
│   Conv(128→128)→ReLU→MaxPool  │     (asymmetric pooling 2×1)
│   Conv(128→256)→BN→ReLU       │     Stage 4: 256 filters
│   Conv(256→256)→BN→ReLU       │     (asymmetric pooling 2×1)
│   Conv(256→256)→ReLU          │     Stage 5: 256 filters (2×1 conv)
│                               │
│   Output: (batch, 256, 1, W') │
└───────────┬───────────────────┘
            │
            ▼  Permute + AdaptiveAvgPool → (batch, W', 256)
            │
┌───────────────────────────────┐
│   Bidirectional LSTM          │
│   (Two stacked layers)       │
│                               │
│   BiLSTM(256→256)             │     Layer 1: 256 hidden × 2 dirs = 512
│   Linear(512→256)             │     Project back to 256
│                               │
│   BiLSTM(256→256)             │     Layer 2: same structure
│   Linear(512→256)             │     Project back to 256
│                               │
│   Output: (batch, W', 256)    │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│   Linear Prediction Layer     │
│   Linear(256 → 91)           │     91 = 90 characters + 1 CTC blank
│                               │
│   Output: (W', batch, 91)     │     Transposed for CTC format
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│   CTC Greedy Decoding         │
│                               │
│   1. Softmax along class dim  │
│   2. Argmax at each timestep  │
│   3. Collapse repeated chars  │
│   4. Remove blank tokens      │
│                               │
│   Output: "10k" (0.95 conf)   │
└───────────────────────────────┘
```

### 4.3 VGG Feature Extractor — Layer by Layer

The VGG-style backbone progressively reduces spatial dimensions while increasing channel depth:

| Layer | Operation | Input Shape | Output Shape | Params |
|---|---|---|---|---|
| 1 | Conv2d(1, 32, 3×3, pad=1) + ReLU | (1, 32, W) | (32, 32, W) | 320 |
| 2 | MaxPool(2×2) | (32, 32, W) | (32, 16, W/2) | — |
| 3 | Conv2d(32, 64, 3×3, pad=1) + ReLU | (32, 16, W/2) | (64, 16, W/2) | 18,496 |
| 4 | MaxPool(2×2) | (64, 16, W/2) | (64, 8, W/4) | — |
| 5 | Conv2d(64, 128, 3×3, pad=1) + ReLU | (64, 8, W/4) | (128, 8, W/4) | 73,856 |
| 6 | Conv2d(128, 128, 3×3, pad=1) + ReLU | (128, 8, W/4) | (128, 8, W/4) | 147,584 |
| 7 | MaxPool(2×1, stride=2×1) | (128, 8, W/4) | (128, 4, W/4) | — |
| 8 | Conv2d(128, 256, 3×3, pad=1) + BN + ReLU | (128, 4, W/4) | (256, 4, W/4) | 295,424 |
| 9 | Conv2d(256, 256, 3×3, pad=1) + BN + ReLU | (256, 4, W/4) | (256, 4, W/4) | 590,336 |
| 10 | MaxPool(2×1, stride=2×1) | (256, 4, W/4) | (256, 2, W/4) | — |
| 11 | Conv2d(256, 256, 2×1) + ReLU | (256, 2, W/4) | (256, 1, W/4−1) | 131,328 |

**Key design: asymmetric pooling (2×1).** The height is reduced aggressively to 1 pixel (creating a 1D sequence), but the width is preserved to maintain the horizontal positional information needed for character-by-character reading.

### 4.4 Bidirectional LSTM — How It Works

**LSTM (Long Short-Term Memory)** is a type of RNN that can learn long-range dependencies through a gating mechanism:

$$f_t = \sigma(W_f \cdot [h_{t-1}, x_t] + b_f) \quad \text{(forget gate)}$$
$$i_t = \sigma(W_i \cdot [h_{t-1}, x_t] + b_i) \quad \text{(input gate)}$$
$$\tilde{c}_t = \tanh(W_c \cdot [h_{t-1}, x_t] + b_c) \quad \text{(candidate cell)}$$
$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t \quad \text{(cell state update)}$$
$$o_t = \sigma(W_o \cdot [h_{t-1}, x_t] + b_o) \quad \text{(output gate)}$$
$$h_t = o_t \odot \tanh(c_t) \quad \text{(hidden state)}$$

**Bidirectional:** Two separate LSTMs run in parallel — one reads left-to-right, the other right-to-left. Their outputs are concatenated at each timestep, giving each position context from both directions. This is essential for text recognition where a character like "l" might be disambiguated only by looking at both preceding and following characters.

**Why 2 stacked layers?** The first BiLSTM layer captures local character patterns. The second layer captures longer-range dependencies (e.g., "uF" always follows a number, "k" is a multiplier prefix).

### 4.5 CTC Decoding — Connectionist Temporal Classification

**CTC** solves the alignment problem: the feature sequence from the CNN has W' timesteps, but the output text has a different (shorter) length. CTC allows the network to output the correct character sequence without needing explicit alignment between input positions and output characters.

#### How CTC Works

1. At each of the W' timesteps, the network predicts a probability distribution over 91 classes (90 chars + 1 **blank** token)
2. The **blank token** (index 0) represents "no character at this position"
3. **Greedy decoding** takes the argmax at each timestep
4. **Collapse rule:** Consecutive identical characters are merged into one, and blank tokens are removed

#### Example

```
Timestep:  1    2    3    4    5    6    7    8    9   10
Predicted: 1    1    -    0    -    -    k    k    -    -
           ↓ collapse repeated + remove blanks ↓
Output:    "10k"
```

Where `-` represents the blank token.

#### CTC with Confidence

Our implementation also returns confidence scores:

```python
def _greedy_decode_with_confidence(output):
    probs = output.softmax(2)
    max_probs, max_indices = probs.max(2)
    # For each non-blank, non-repeated character, record its probability
    # Confidence = mean of selected character probabilities
```

### 4.6 Image Preprocessing

All images are preprocessed identically:

```python
_transform = transforms.Compose([
    _ResizeKeepAspectRatio(32),   # Resize height to 32px, keep aspect ratio
    transforms.ToTensor(),         # [0, 255] → [0.0, 1.0]
    transforms.Normalize((0.5,), (0.5,)),  # Center around 0: [−1.0, 1.0]
])
```

**`_ResizeKeepAspectRatio(32)`:** Resizes the image so height = 32 pixels while width scales proportionally. A text crop of "100kΩ" that is 80×20 pixels becomes 128×32 pixels. This preserves the character aspect ratios.

**Grayscale conversion:** The crop is converted to single-channel grayscale before processing, since circuit text color is not informative (black ink on white paper).

### 4.7 Implementation: `CustomOCRService` Class

**File:** `test/custom_ocr.py`

```python
class CustomOCRService:
    def __init__(self, model_path=_DEFAULT_MODEL_PATH, device=None):
        self._model_path = model_path
        self._device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self._model = None  # CRNN instance
```

**Design patterns (same as TrOCR):**
- Lazy model loading
- Singleton via `get_custom_ocr_service()`
- Same `extract_texts()` API for drop-in replacement

**Model weights:** `customOCR/crnn_last (1).pth` (~8MB)

---

## 5. OCR Mode Selection

The unified pipeline supports two modes selected by the user:

```python
def _get_ocr(ocr_mode: str = "fast"):
    if ocr_mode == "slow":
        return get_ocr_service()      # TrOCR
    return get_custom_ocr_service()    # CRNN
```

### When to Use Each Mode

| Scenario | Recommended Mode | Why |
|---|---|---|
| Clean, printed-style text | Fast (CRNN) | CRNN handles clean text well and is 10× faster |
| Messy handwriting | Slow (TrOCR) | Transformer cross-attention better handles noise |
| Many text labels (>10) | Fast (CRNN) | Batched CRNN is faster for many crops |
| Critical accuracy needed | Slow (TrOCR) | Higher accuracy for ambiguous characters |
| CPU-only deployment | Fast (CRNN) | CRNN is fast even without GPU |

### Frontend Integration

The frontend sends the OCR mode as a form field:

```javascript
formData.append("ocr_mode", ocrMode);  // "fast" or "slow"
```

The backend FastAPI endpoint passes it through:

```python
@app.post("/analyze")
async def analyze_circuit_image(
    file: UploadFile = File(...),
    ocr_mode: str = Form("fast"),
):
    result = preview_analysis(image_bytes, ocr_mode=ocr_mode)
```

---

## 6. Text Extraction Pipeline

The full OCR pipeline from raw image to component values:

```
Step 1: YOLO detects text regions (class 11)
        → text_boxes = [{bbox: [100, 50, 180, 80], cls: 11, name: "text", ...}]

Step 2: OCR service crops each text region from full image
        → crops = [PIL.Image(80×30), PIL.Image(60×25), ...]

Step 3: OCR inference (CRNN or TrOCR)
        → text_results = [{bbox: ..., ocr_text: "10k", ocr_confidence: 0.95}, ...]

Step 4: Proximity mapper assigns each text to nearest component
        → components[i].value = "10k"
        → components[i].value_confidence = 0.95

Step 5: Unit extraction from value string
        → "10k" → unit = "Ω" (Ohms assumed for bare numeric+prefix)
        → "4.7uF" → unit = "F" (Farads)
        → "5V" → unit = "V" (Volts)
```

---

## 7. Confidence Scoring

### TrOCR Confidence

TrOCR computes confidence from the **mean token log-probabilities** of the generated sequence:

```python
# For each generated token (excluding BOS and EOS):
#   Get log_softmax of model output
#   Select the log-prob of the chosen token
# Confidence = exp(mean of selected log-probs)
```

$$\text{confidence} = \exp\left(\frac{1}{N} \sum_{i=1}^{N} \log P(t_i \mid t_{<i}, \text{image})\right)$$

This is the **geometric mean** of token probabilities. A confidence of 0.95 means the model was, on average, 95% sure about each character.

### CRNN Confidence

CRNN computes confidence from the **mean of max softmax probabilities** at each non-blank, non-repeated CTC timestep:

```python
# At each CTC timestep that produces a non-blank, non-repeated character:
#   Record the max softmax probability
# Confidence = mean of these probabilities
```

$$\text{confidence} = \frac{1}{N} \sum_{i=1}^{N} \max_{c} P(c \mid \text{feature}_i)$$

### Confidence Thresholds

No hard confidence threshold is applied in the pipeline. All OCR results are returned to the frontend with their confidence scores. The user can inspect low-confidence results during the review step and manually correct them.

---

## 8. Character Set & Domain-Specific Considerations

### CRNN Character Set (90 characters)

```python
CHARS = list(
    '!"#$%&()*+,-./0123456789:<=>?@'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ^_`'
    'abcdefghijklmnopqrstuvwxyz~§µ×ßäöüΩ'
)
```

**Total:** 90 characters + 1 CTC blank = 91 output classes

**Domain-specific characters:**
- `Ω` (Omega) — Ohms unit symbol
- `µ` (micro) — SI prefix for micro (10⁻⁶)
- `×` (multiplication) — Used in values like "2.2×10³"

**Missing characters that could cause issues:**
- `∞` (infinity) — Can appear in theoretical discussions
- Subscript/superscript formatting — OCR produces flat text

### TrOCR Character Set

TrOCR uses a **full tokenizer vocabulary** (50,260 tokens for GPT-2) and can produce any character combination. However, for circuit text, we set `max_new_tokens=16` to prevent hallucination of long strings.

---

## 9. Preprocessing Pipeline

### For CRNN

```
Raw BGR crop
    │
    ├─ cv2.cvtColor(crop, BGR2GRAY)     → Grayscale (single channel)
    │
    ├─ PIL.Image.fromarray(gray)         → PIL Image object
    │
    ├─ _ResizeKeepAspectRatio(32)        → Height = 32px, width proportional
    │
    ├─ transforms.ToTensor()             → [0.0, 1.0] float tensor
    │
    ├─ transforms.Normalize((0.5,), (0.5,))  → [-1.0, 1.0] centered
    │
    └─ .unsqueeze(0)                     → Add batch dimension: (1, 1, 32, W)
```

### For TrOCR

```
Raw BGR crop
    │
    ├─ cv2.cvtColor(crop, BGR2RGB)       → RGB (3 channels)
    │
    ├─ PIL.Image.fromarray(rgb)          → PIL Image object
    │
    ├─ TrOCRProcessor(images=pil_img)    → Resized to 384×384
    │   (internal resize + normalization)    Normalized to ImageNet stats
    │
    └─ .pixel_values.to(device)          → (1, 3, 384, 384) tensor
        .half() if CUDA                     Float16 for speed
```

---

## 10. Training Details

### CRNN Training

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/custom_OCR_loss_curve.png" alt="Custom OCR Training Loss" width="75%">
</p>
<p align="center"><em>Custom CRNN training loss over 27 epochs. The consistent decrease indicates effective learning; slight validation uptick at epoch 26 triggered early stopping.</em></p>

- **Dataset:** Synthetic + real cropped text regions from circuit diagrams
- **Loss function:** CTC Loss (Connectionist Temporal Classification)
- **Optimizer:** Adam (likely; standard for CRNN training)
- **Input:** Grayscale images, height normalized to 32 pixels
- **Output:** Character sequence with CTC blank tokens
- **Checkpoint:** `customOCR/crnn_last (1).pth`

### TrOCR Fine-Tuning

- **Base model:** `microsoft/trocr-small-printed` (pre-trained on printed text)
- **Fine-tuning data:** Cropped text regions from hand-drawn circuit diagrams with ground-truth labels
- **Loss function:** Standard language model cross-entropy loss
- **Training:** 2 epochs with early stopping (performance plateaued)
- **Checkpoint:** `OCRmodel/trocrfinetuned/checkpoint-epoch-2/`
- **Base model also stored:** `OCRmodel/trocr-small-printed/` (for reference)

---

## 11. File Reference

### OCR Performance Metrics

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/cer_wer.png" alt="CER and WER Distributions" width="85%">
</p>
<p align="center"><em>Custom OCR performance distributions: Accuracy = 66.77%, CER ≈ 0.25, WER ≈ 0.33. The WER histogram is binary (correct or incorrect) since component values are short single-word strings.</em></p>

### OCR Model Comparison

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/ocr_model_comparison.png" alt="OCR Model Comparison" width="60%">
</p>
<p align="center"><em>Head-to-head comparison: Fine-tuned TrOCR achieves 84.5% accuracy, 0.12 CER, and 0.18 WER — outperforming the custom CRNN across all metrics.</em></p>

### Visual Results Comparison

| Custom CRNN (Fast) | TrOCR (Accurate) |
|---|---|
| <img src="../circuitron_final_report/src/images/figures/custom_ocr_result1.png" alt="Custom OCR Result 1" width="450"> | <img src="../circuitron_final_report/src/images/figures/trocr_result1.png" alt="TrOCR Result 1" width="450"> |
| <img src="../circuitron_final_report/src/images/figures/custom_ocr_result2.png" alt="Custom OCR Result 2" width="450"> | <img src="../circuitron_final_report/src/images/figures/trocr_result2.png" alt="TrOCR Result 2" width="450"> |

<p align="center"><em>Side-by-side visual comparison on two test images. TrOCR correctly recognizes most component values while CRNN struggles with ambiguous characters.</em></p>

| File | Purpose |
|---|---|
| `test/ocr_service.py` | TrOCR OCR service (slow/accurate mode) |
| `test/custom_ocr.py` | CRNN OCR service (fast mode) |
| `test/ocr_engine.py` | Compatibility shim: re-exports OCRService as OCREngine |
| `OCRmodel/trocrfinetuned/checkpoint-epoch-2/` | Fine-tuned TrOCR weights |
| `OCRmodel/trocr-small-printed/` | Base TrOCR model (Microsoft) |
| `customOCR/crnn_last (1).pth` | Trained CRNN weights |
| `customOCR/easyOCRstuff/` | Earlier EasyOCR experiments (deprecated) |
| `run_trocr_test.py` | Standalone TrOCR test script |

---

## 12. Viva Questions & Answers

### Q1: What is TrOCR and how does it differ from traditional OCR like Tesseract?
**A:** TrOCR is a transformer-based OCR model that uses a Vision Transformer (ViT) encoder to understand the image and a GPT-2 decoder to generate text autoregressively (one character at a time). Traditional OCR systems like Tesseract use a pipeline of handcrafted preprocessing (binarization, deskew, line segmentation) followed by character-by-character template matching or CNN classification. TrOCR is end-to-end trainable — it learns to go directly from pixels to text without any manual preprocessing steps. This makes it far more robust to noise, handwriting variation, and unusual fonts.

### Q2: What is a Vision Transformer (ViT) and how does it work?
**A:** ViT (Vision Transformer) treats an image as a sequence of patches by splitting the image into a grid of non-overlapping 16×16 pixel patches. Each patch is linearly projected into an embedding vector, and learnable position encodings are added. These patch embeddings are then processed by a standard Transformer encoder (self-attention + feed-forward layers). Self-attention allows each patch to attend to every other patch, capturing global relationships across the entire image — unlike CNNs which only see local neighborhoods.

### Q3: What is CRNN and why did you implement a custom one?
**A:** CRNN (Convolutional Recurrent Neural Network) combines a CNN feature extractor with a Bidirectional LSTM sequence model and CTC decoding. We implemented a custom CRNN because: (1) It's ~10× faster than TrOCR (~5ms vs ~50ms per crop), making it suitable for real-time use. (2) The model is tiny (~8MB vs ~240MB), important for deployment. (3) For clean, well-defined circuit text, its accuracy is comparable to TrOCR. We provide both so users can choose speed vs. accuracy.

### Q4: What is CTC (Connectionist Temporal Classification) and why is it needed?
**A:** CTC solves the alignment problem in sequence recognition. The CNN outputs a feature sequence of length W' (one feature per horizontal position), but the target text is shorter (e.g., "10k" = 3 chars but W' might be 32). CTC introduces a blank token and a collapsing rule: consecutive same characters are merged, and blanks are removed. During training, CTC loss marginalizes over all valid alignments between the feature sequence and the target text, so the network doesn't need explicit per-position character labels. At inference, greedy decoding (argmax + collapse) is used.

### Q5: Why do you use a Bidirectional LSTM instead of a unidirectional one?
**A:** A unidirectional LSTM reads the feature sequence only left-to-right, so each position only has context from preceding characters. A Bidirectional LSTM runs two parallel LSTMs — one left-to-right and one right-to-left — and concatenates their outputs. This gives each position full context from both directions. For text recognition, this is critical: the character "l" might look like "1" or "I" in isolation, but bidirectional context (what comes before AND after) disambiguates it. For circuit text like "10kΩ", the "k" helps the LSTM confirm that "10" is likely correct numbers rather than "l0".

### Q6: What is the difference between the VGG feature extractor and ResNet?
**A:** Our VGG-style extractor uses simple stacked 3×3 convolutions with max pooling — no skip connections. ResNet uses residual connections (shortcut paths that add the input directly to the output), which help train very deep networks (50–152 layers). Our CRNN doesn't need residual connections because it's relatively shallow (11 layers). The VGG architecture is simpler, has fewer parameters, and is fast enough for our text recognition task where input images are small (32 pixels tall).

### Q7: Why is asymmetric pooling (2×1) used in the feature extractor?
**A:** Asymmetric pooling (kernel 2×1, stride 2×1) reduces the height by half but preserves the width. This is intentional: text is arranged horizontally, so we need to maintain horizontal spatial resolution to distinguish individual characters. By the time features reach the LSTM, the height is collapsed to 1 pixel (a 1D sequence), while the width still preserves character-level granularity. If we used symmetric 2×2 pooling everywhere, we'd lose too much horizontal resolution and characters would blend together.

### Q8: How does batched inference work in TrOCR?
**A:** Instead of processing each text crop individually, we collect all crops from one circuit image and process them in a single forward pass. The TrOCRProcessor pads all images to the same size, creating a batch tensor of shape (B, 3, 384, 384). The model processes all B images simultaneously through the encoder, and the decoder generates text for all B sequences in parallel using batched matrix operations. This maximizes GPU utilization — processing 10 crops takes nearly the same time as processing 1 crop.

### Q9: What is the attention mechanism in TrOCR's decoder?
**A:** The decoder uses two types of attention: (1) **Self-attention** with a causal mask — each generated token attends to all previous tokens but not future ones, maintaining autoregressive generation order. (2) **Cross-attention** — each decoder layer attends to the encoder's visual feature sequence (576 patch embeddings), allowing the decoder to "look at" relevant parts of the image when predicting each character. For example, when generating the "k" in "10k", cross-attention focuses on the right portion of the text crop where "k" appears visually.

### Q10: How do you compute confidence scores for OCR results?
**A:** For TrOCR: We collect the log-softmax probability of each generated token and average them, then exponentiate: $\text{conf} = \exp(\text{mean}(\log P(t_i)))$. This is the geometric mean of token probabilities. For CRNN: At each CTC timestep that produces a non-blank, non-repeated character, we record the max softmax probability. The confidence is the arithmetic mean of these values. Both approaches give a [0, 1] score where higher means the model is more certain about every character.

### Q11: What is the purpose of the OCR engine shim (`ocr_engine.py`)?
**A:** `ocr_engine.py` is a simple compatibility layer that re-exports `OCRService` as `OCREngine`. This was created when we refactored the codebase — older code imported `OCREngine` but the main implementation was renamed to `OCRService`. The shim prevents breaking existing imports without requiring changes to all calling code.

### Q12: Why did you fine-tune TrOCR instead of training from scratch?
**A:** Training a transformer-based OCR model from scratch requires millions of text images and weeks of GPU time. By fine-tuning from `microsoft/trocr-small-printed` (which was already trained on millions of synthetic and real text images), we leverage the model's pre-existing knowledge of character shapes, spacing, and visual patterns. We only need to teach it the specific characteristics of hand-drawn circuit text (engineering units, SI prefixes, typical value formats). This required only 2 epochs of fine-tuning on our small circuit text dataset.

### Q13: How does the `max_new_tokens=16` limit work in TrOCR?
**A:** During autoregressive generation, the decoder produces one token per step. We set `max_new_tokens=16` to force generation to stop after 16 tokens even if no `<EOS>` token has been produced. Since circuit text labels are typically 2–6 characters (e.g., "10k", "4.7uF", "100Ω"), 16 tokens is more than sufficient. This prevents the model from hallucinating long strings on noisy or ambiguous crops, which could happen with the default limit of 32+ tokens for general OCR.

### Q14: What happens when a text crop is too small or blank?
**A:** The `extract_texts()` method checks if the cropped region has valid dimensions (x2 > x1 and y2 > y1). If the crop is invalid (zero-width or zero-height), it returns an empty string with 0.0 confidence. For very small but valid crops, the preprocessing resizes them to the expected input dimensions. The model may produce low-confidence gibberish, but the confidence score will be low (~0.1–0.3), alerting the user during the review step.

### Q15: What is EasyOCR and why did you move away from it?
**A:** EasyOCR is an open-source OCR library that uses a CRNN-based architecture. We initially experimented with it (evidenced by `customOCR/easyOCRstuff/` and `OCRmodel/EasyOCR.ipynb`), but moved to a custom CRNN and fine-tuned TrOCR because: (1) EasyOCR's default character set didn't include engineering symbols (Ω, µ). (2) Its pretrained model was optimized for general text, not circuit-specific labels. (3) Fine-tuning EasyOCR's model directly was less flexible than building our own CRNN with a custom character set.

### Q16: How does float16 (half precision) help TrOCR inference?
**A:** Float16 (half precision) uses 16-bit floating point numbers instead of the standard 32-bit. This halves memory usage and doubles throughput on GPUs with Tensor Cores (NVIDIA Volta and newer). For TrOCR with ~60M parameters, float16 reduces GPU memory from ~240MB to ~120MB and increases inference speed by ~1.5–2×. The accuracy loss is negligible because inference (unlike training) doesn't accumulate rounding errors over thousands of iterations.

### Q17: What is the difference between encoder-decoder (TrOCR) and CTC-based (CRNN) OCR?
**A:** **CTC-based (CRNN):** The entire feature sequence is processed at once, and CTC decoding aligns features to characters. It's non-autoregressive — all characters are predicted simultaneously. It's faster but can't model dependencies between output characters (each character is predicted independently). **Encoder-decoder (TrOCR):** The decoder generates characters one at a time, each conditioned on all previously generated characters. This autoregressive approach can model character-level language patterns (e.g., "uF" is more likely than "uZ" after a number) but is inherently sequential and slower.

### Q18: What is the role of BatchNorm in the CRNN?
**A:** BatchNorm (used in the last two convolutional layers) normalizes the activations across the batch dimension, stabilizing training and allowing higher learning rates. In our CRNN, BatchNorm is applied only in the deeper layers (stages 4–5) where the feature dimension is 256. The earlier layers use only ReLU activation without normalization, which is sufficient for the simpler features they extract.

### Q19: How would you improve the OCR system further?
**A:** Possible improvements: (1) **Data augmentation** during training — add random noise, blur, rotation, and scaling to simulate real handwriting variation. (2) **Beam search** instead of greedy decoding — explore multiple token sequences and select the highest-probability complete sequence. (3) **Domain-specific language model** — a character-level model trained on circuit values could bias decoding toward valid engineering notation. (4) **Attention-based CRNN** — add an attention mechanism between the CNN and LSTM to focus on relevant character regions. (5) **Ensemble** — combine CRNN and TrOCR predictions, using the one with higher confidence.

### Q20: What is the `flatten_parameters()` call in the BiLSTM?
**A:** `self.rnn.flatten_parameters()` is a PyTorch optimization for RNNs on CUDA. It rearranges the weight tensors in contiguous memory blocks, which is required for the cuDNN fast LSTM implementation. Without it, the LSTM might run on a slower fallback code path. The try/except wraps it because it can fail on CPU or in certain device-transfer scenarios, but the LSTM still works correctly — just slightly slower.
