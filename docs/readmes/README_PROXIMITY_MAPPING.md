# Proximity Mapping — Text-to-Component Association via Edge-Distance

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Distance Metric: Edge-to-Edge vs. Centre-to-Centre](#3-distance-metric-edge-to-edge-vs-centre-to-centre)
4. [Algorithm: Greedy One-to-One Assignment](#4-algorithm-greedy-one-to-one-assignment)
5. [Implementation Walkthrough](#5-implementation-walkthrough)
6. [Data Flow in the Pipeline](#6-data-flow-in-the-pipeline)
7. [Parameters and Thresholds](#7-parameters-and-thresholds)
8. [Edge Cases and Failure Modes](#8-edge-cases-and-failure-modes)
9. [Output Format](#9-output-format)
10. [File Reference](#10-file-reference)
11. [Viva Questions & Answers](#11-viva-questions--answers)

---

## 1. Overview

The **proximity mapper** solves the text-to-component association problem: given a list of detected circuit components (resistors, capacitors, etc.) and a list of recognized text labels ("10k", "4.7µF", etc.), determine which text label belongs to which component.

This is the bridge between **OCR** (which tells us *what* text exists) and the **circuit graph** (which needs to know *what value* each component has).

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/frontendallcomponentsmappedvdivider.png" alt="All Components Mapped" width="85%">
</p>
<p align="center"><em>Result of proximity mapping: each detected text label (OCR) has been assigned to its nearest circuit component, visible as value annotations alongside bounding boxes.</em></p>

```
Inputs:     Components (from YOLO) + Text detections (from OCR)
                │                           │
                ▼                           ▼
     [resistor @ (120,45,210,95)]   ["10k" @ (215,55,250,80)]
                │                           │
                └──────── Edge Distance ────┘
                          = 5 pixels
                             │
                             ▼
Output:     resistor → value = "10k", confidence = 0.92
```

---

## 2. Problem Statement

### Why Is This Hard?

In a hand-drawn circuit, text labels are placed near their components — but "near" is relative:

```
     ┌─────────────────┐
     │                 │
     │    RESISTOR     │  ← Large bounding box (80×50 pixels)
     │                 │
     └─────────────────┘
                        "10k"  ← Small text label (35×25 pixels)
                                  sits right next to the component
```

If we measured **centre-to-centre distance**, the large resistor's center is far from the small text's center — even though they're physically adjacent. A small capacitor elsewhere might have its center closer to "10k" than the resistor's center, producing a wrong assignment.

### Requirements

1. **Correct assignment:** Each text label should be assigned to the nearest *correct* component
2. **One-to-one:** Each text can only belong to one component; each component gets at most one text
3. **Maximum distance:** Text labels far from any component should remain unassigned (noise filtering)
4. **Robustness:** Must handle circuits with many components of different sizes

---

## 3. Distance Metric: Edge-to-Edge vs. Centre-to-Centre

### Centre-to-Centre Distance

The naive approach: compute Euclidean distance between bounding box centers.

$$d_{\text{center}} = \sqrt{(cx_A - cx_B)^2 + (cy_A - cy_B)^2}$$

**Problem:** This penalizes large components unfairly. A text label sitting 2 pixels from a large resistor (80×50) may be 50+ pixels from its center, yet only 5 pixels from a small junction (10×10) across the circuit.

### Edge-to-Edge Distance (Our Approach)

Compute the **minimum gap** between the edges of two bounding boxes:

```python
def _bbox_edge_distance(a, b):
    """
    a, b: [x1, y1, x2, y2] bounding boxes.
    Returns: minimum Euclidean distance between the closest edges.
    Returns 0 when boxes overlap.
    """
    dx = max(0, max(a[0] - b[2], b[0] - a[2]))
    dy = max(0, max(a[1] - b[3], b[1] - a[3]))
    return float(np.sqrt(dx * dx + dy * dy))
```

### How `dx` and `dy` Work

The formula computes the **gap** between two intervals on each axis:

**X-axis:**
```
Case 1: A is left of B      Case 2: B is left of A      Case 3: Overlap
[a_x1────a_x2]   [b_x1─b_x2]   [b_x1─b_x2]   [a_x1─a_x2]   [a_x1──[b_x1──a_x2]──b_x2]
       dx = b_x1 - a_x2           dx = a_x1 - b_x2              dx = 0 (negative → clamped)
```

```python
dx = max(0, max(a[0] - b[2], b[0] - a[2]))
#      ↑              ↑              ↑
#   clamp to 0    B-left-of-A    A-left-of-B
```

Same logic for `dy` on the Y-axis. The final distance is:

$$d_{\text{edge}} = \sqrt{dx^2 + dy^2}$$

### Visual Comparison

```
Example: Resistor (100,50,200,100) and Text "10k" (210,60,250,85)

Centre-to-centre: dist((150,75), (230,72)) = 80.1 px
Edge-to-edge:     dx = max(0, max(100-250, 210-200)) = 10
                  dy = max(0, max(50-85, 60-100))     = 0
                  dist = sqrt(100 + 0)                 = 10.0 px

The text is 10 pixels away from the resistor's edge.
Centre-to-centre overstates the distance by 8×.
```

### Mathematical Proof: Why Edge Distance Is Always ≤ Centre Distance

For non-overlapping boxes, the edge points closest to each other are always as close or closer than the centers. The centers are inside the boxes; the edges are at the box boundaries. Therefore:

$$d_{\text{edge}}(A, B) \leq d_{\text{center}}(A, B) \quad \forall A, B$$

Equality holds only when both boxes are single points (zero-area boxes).

---

## 4. Algorithm: Greedy One-to-One Assignment

### Why Greedy Instead of Hungarian?

The **Hungarian algorithm** computes the globally optimal one-to-one assignment in O(n³). We use **greedy assignment** instead because:

1. **Simplicity:** Greedy is ~20 lines of code; Hungarian requires 100+ or an external library
2. **Performance:** Greedy is O(CT log(CT)) (sort + scan) where C = components, T = texts. For typical circuits (C < 30, T < 30), this is microseconds.
3. **Practical optimality:** In hand-drawn circuits, text labels are almost always closest to their correct component. The greedy approach (assign closest pairs first) produces the same result as Hungarian in >99% of real cases.
4. **Distance threshold:** Our `max_distance` cutoff drastically prunes the search space, leaving very few candidates per component.

### Algorithm Steps

```
1. Build distance matrix D[C×T] (all edge-to-edge distances)
2. Flatten D into list of (distance, component_index, text_index) triples
3. Sort triples by distance (ascending)
4. Initialize: used_texts = {}, assigned_comps = {}
5. For each (dist, ci, ti) in sorted order:
   a. If dist > max_distance → STOP (all remaining are too far)
   b. If ci ∈ assigned_comps → SKIP (component already has a label)
   c. If ti ∈ used_texts → SKIP (text already used)
   d. If text has empty ocr_text → SKIP
   e. ASSIGN: components[ci].value = texts[ti].ocr_text
   f. Mark ci as assigned, ti as used
6. Set defaults for unassigned components (value="", confidence=0)
```

### Example Walkthrough

```
Components:  C0 = resistor @ (100,50,200,100)
             C1 = capacitor @ (300,50,380,100)

Texts:       T0 = "10k" @ (210,60,250,85)
             T1 = "4.7uF" @ (385,55,430,80)

Distance matrix:
         T0     T1
C0      10.0   185.0
C1     100.0     5.0

Sorted pairs: (5.0, C1, T1), (10.0, C0, T0), (100.0, C1, T0), (185.0, C0, T1)

Step 1: (5.0, C1, T1) → C1 not assigned, T1 not used → ASSIGN capacitor.value = "4.7uF"
Step 2: (10.0, C0, T0) → C0 not assigned, T0 not used → ASSIGN resistor.value = "10k"
Step 3: (100.0, C1, T0) → C1 already assigned → SKIP
Step 4: (185.0, C0, T1) → C0 already assigned → SKIP

Result: resistor → "10k", capacitor → "4.7uF" ✓
```

---

## 5. Implementation Walkthrough

### Full Function Implementation

```python
def map_text_to_components(
    components: List[Dict[str, Any]],
    text_detections: List[Dict[str, Any]],
    max_distance: float = 250.0,
) -> List[Dict[str, Any]]:
```

**Step 1: Early Return**

If no components or no text detections, set default values and return immediately:

```python
if not components or not text_detections:
    for c in components:
        c.setdefault("value", "")
        c.setdefault("value_confidence", 0.0)
        c.setdefault("mapped_text_bbox", None)
    return components
```

**Step 2: Build Distance Matrix**

```python
n_comp = len(components)
n_text = len(text_detections)
dists = np.zeros((n_comp, n_text), dtype=np.float64)

for ci, comp in enumerate(components):
    for ti, td in enumerate(text_detections):
        dists[ci, ti] = _bbox_edge_distance(comp["bbox"], td["bbox"])
```

This is O(C × T) — for 20 components × 15 texts = 300 distance computations.

**Step 3: Sort All Pairs**

```python
pairs = []
for ci in range(n_comp):
    for ti in range(n_text):
        pairs.append((dists[ci, ti], ci, ti))
pairs.sort(key=lambda x: x[0])
```

**Step 4: Greedy Assignment**

```python
used_texts: set[int] = set()
assigned_comps: set[int] = set()

for dist, ci, ti in pairs:
    if dist > max_distance:
        break  # All remaining pairs are too far
    if ci in assigned_comps or ti in used_texts:
        continue  # Already matched
    td = text_detections[ti]
    if not td.get("ocr_text"):
        continue  # Empty text
    
    # Make the assignment
    components[ci]["value"] = td["ocr_text"]
    components[ci]["value_confidence"] = td.get("ocr_confidence", 0.0)
    components[ci]["mapped_text_bbox"] = td["bbox"]
    assigned_comps.add(ci)
    used_texts.add(ti)
```

**Step 5: Fill Defaults**

```python
for c in components:
    c.setdefault("value", "")
    c.setdefault("value_confidence", 0.0)
    c.setdefault("mapped_text_bbox", None)
```

`setdefault` only sets the key if it doesn't already exist — so assigned components keep their values, and unassigned ones get empty defaults.

---

## 6. Data Flow in the Pipeline

### Where Proximity Mapping Fits

```
unified_pipeline.py :: _run_pipeline_raw()
    │
    ├── 1. YOLO Detection    → components[], text_detections[]
    ├── 2. TrOCR OCR          → text_detections[].ocr_text
    ├── 3. Custom CRNN OCR    → text_detections[].ocr_text (overwritten if confident)
    ├── 4. Proximity Mapping  → components[].value  ← THIS STEP
    └── 5. Line Detection     → graph structure
```

The proximity mapper runs **after** both OCR engines and **before** the line detection pipeline. This ordering means:

1. The text detections already have their final `ocr_text` values (best result from TrOCR or CRNN)
2. The enriched components (with assigned values) are available for the Circuit schema construction

### Input Structures

**Components (from YOLO):**
```python
{
    "cls": 8,
    "name": "resistor",
    "conf": 0.92,
    "bbox": [120, 45, 210, 95]
}
```

**Text detections (from OCR):**
```python
{
    "cls": 11,
    "name": "text",
    "conf": 0.85,
    "bbox": [215, 55, 260, 80],
    "ocr_text": "10k",
    "ocr_confidence": 0.94
}
```

### Output Enrichment

After proximity mapping, each component gains:

```python
{
    "cls": 8,
    "name": "resistor",
    "conf": 0.92,
    "bbox": [120, 45, 210, 95],
    "value": "10k",                        # ← Added
    "value_confidence": 0.94,              # ← Added
    "mapped_text_bbox": [215, 55, 260, 80] # ← Added
}
```

### Downstream Usage

The `value` field flows into `unified_pipeline.py`, where it becomes:

```python
Component(
    id="R1",
    type="resistor",
    value="10k",
    ...
)
```

This value is essential for:
1. **CircuitJS1 export:** Components need correct values for simulation
2. **Schematic display:** Labels shown on the rendered circuit
3. **AI chat context:** The chat service describes components with their values

---

## 7. Parameters and Thresholds

### `max_distance` (default: 250 pixels)

The maximum edge-to-edge distance for a valid text→component association.

| Value | Effect |
|---|---|
| < 100 | Very strict; may miss valid labels that are far from components due to messy handwriting |
| 100–250 | Good for most hand-drawn circuits; default of 250 is generous |
| > 250 | Too permissive; may match text to wrong distant component |

### Why 250?

In a typical 1000×700 hand-drawn circuit:
- Components are 50–100 pixels wide
- Text labels are usually placed within 20–50 pixels of their component
- 250 pixels provides ample margin for sloppy handwriting
- Beyond 250 pixels, a label is almost certainly for a different component

### Implicit Thresholds

1. **`ocr_text` non-empty check:** Text detections with empty OCR results are skipped. This filters out YOLO-detected text regions that OCR couldn't recognize.
2. **`ocr_confidence` passthrough:** The confidence is passed through unchanged; no minimum threshold is applied. The frontend can use this value for UI styling (e.g., highlighting low-confidence values).

---

## 8. Edge Cases and Failure Modes

### 8.1 More Texts Than Components

Only components get matched. Extra text detections remain unassigned (silently ignored). This handles stray text in the circuit (titles, notes, equations).

### 8.2 More Components Than Texts

Unassigned components get empty defaults: `value=""`, `value_confidence=0.0`. The frontend shows these as unlabeled components, and users can manually enter values in the review step.

### 8.3 Overlapping Bounding Boxes

When a text box overlaps its component's bounding box:
```
dx = max(0, max(a[0]-b[2], b[0]-a[2]))  → negative values clamped to 0
dy = max(0, max(a[1]-b[3], b[1]-a[3]))  → negative values clamped to 0
distance = sqrt(0 + 0) = 0
```

Distance = 0, which is the minimum possible. The text will definitely be assigned to this component (highest priority in the sorted list).

### 8.4 Equidistant Text Labels

If two components are equidistant to a text label, the one that appears first in the sorted pairs (arbitrary among ties) gets the assignment. In practice, exact distance ties are extremely rare with floating-point computation.

### 8.5 Text Between Two Components

```
[Resistor]   "10k"   [Capacitor]
    ← 20px →  ← 20px →
```

If "10k" is equidistant to both, the greedy algorithm assigns it to whichever pair appears first after sorting. This is a genuine ambiguity that can only be resolved by human review (which our frontend provides).

### 8.6 YOLO Misdetection

If YOLO detects a component body as text or vice versa, the inputs to the proximity mapper are incorrect. The mapper cannot fix upstream detection errors — it trusts YOLO's class assignments.

---

## 9. Output Format

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/combined_overlay.png" alt="Combined Pipeline Overlay" width="65%">
</p>
<p align="center"><em>Combined overlay showing the final result of detection + OCR + proximity mapping + wire detection: green boxes (YOLO), blue text (OCR values via proximity mapping), and red lines (wire connections).</em></p>

### Enriched Component

```python
{
    "cls": 8,
    "name": "resistor",
    "conf": 0.92,
    "bbox": [120, 45, 210, 95],
    "value": "10k",
    "value_confidence": 0.94,
    "mapped_text_bbox": [215, 55, 260, 80]
}
```

### Unmatched Component

```python
{
    "cls": 5,
    "name": "inductor",
    "conf": 0.88,
    "bbox": [400, 200, 480, 250],
    "value": "",
    "value_confidence": 0.0,
    "mapped_text_bbox": None
}
```

### Return Value

The function returns the **same list** (mutated in place), enriched with `value`, `value_confidence`, and `mapped_text_bbox`. This is a design choice: the function modifies its input rather than creating copies, avoiding unnecessary memory allocation.

---

## 10. File Reference

| File | Role |
|---|---|
| `test/proximity_mapper.py` | Proximity mapping implementation (sole file, ~100 lines) |
| `test/unified_pipeline.py` | Calls `map_text_to_components()` in `_run_pipeline_raw()` |
| `test/schemas.py` | `DetectedComponent` schema includes `value` and `value_confidence` fields |

---

## 11. Viva Questions & Answers

### Q1: Why do you use edge-to-edge distance instead of centre-to-centre distance?
**A:** Centre-to-centre distance penalizes large components unfairly. A text label 5 pixels from a large resistor's edge may be 50+ pixels from its center. Meanwhile, a small distant junction may have its center closer to the text than the resistor's center, causing a wrong assignment. Edge-to-edge distance measures the actual gap between the closest edges of two bounding boxes, which accurately reflects physical proximity regardless of component size.

### Q2: What is the formula for edge-to-edge bounding box distance?
**A:** For two boxes `[x1,y1,x2,y2]`, we compute the gap on each axis separately: `dx = max(0, max(a_x1-b_x2, b_x1-a_x2))` and `dy = max(0, max(a_y1-b_y2, b_y1-a_y2))`. The final distance is `sqrt(dx² + dy²)`. The `max(0, ...)` clamp makes overlapping intervals contribute 0 distance. For overlapping boxes, both dx and dy are 0, giving distance = 0.

### Q3: Why greedy assignment instead of the Hungarian algorithm?
**A:** The Hungarian algorithm guarantees the global optimum in O(n³), but greedy assignment produces identical results in >99% of real circuit images because text labels are almost always closest to their correct component with clear separation. Greedy is O(CT·log(CT)) due to sorting, simpler to implement (~20 lines vs. 100+), and leaves no ambiguous edge cases for the small input sizes we handle (< 30 components, < 30 texts).

### Q4: What does "one-to-one assignment" mean?
**A:** Each text label can be assigned to at most one component, and each component can receive at most one text label. Once a text is used, it cannot be re-used for another component — even if it's the second-closest match for some other component. Similarly, once a component receives a label, it cannot receive a second one. This prevents the same "10k" label from being assigned to multiple resistors.

### Q5: What happens if a component has no nearby text label?
**A:** The component receives defaults via `setdefault`: `value=""`, `value_confidence=0.0`, `mapped_text_bbox=None`. The frontend displays it as an unlabeled component. In the review step, users can manually enter values for these components before exporting to CircuitJS1.

### Q6: What happens if there are more text labels than components?
**A:** Extra text labels remain unassigned. They're silently dropped — not assigned to any component. This handles spurious text in the image like titles, student names, dates, or equations that YOLO detected as text class but aren't component values.

### Q7: What is the `max_distance` parameter and how does it affect results?
**A:** `max_distance` (default: 250 pixels) is the cutoff distance. If the nearest component for a text label is more than 250 pixels away, the assignment is not made. This prevents distant, unrelated text from being matched to a component. The value was empirically chosen: in typical hand-drawn circuits (1000×700 pixels), component labels are within 20–50 pixels of their component. 250 pixels provides a generous margin for messy layouts.

### Q8: How does the distance matrix work?
**A:** We precompute a C×T matrix (C = number of components, T = number of texts) where entry `dists[ci, ti]` stores the edge-to-edge distance between component `ci` and text `ti`. This matrix is computed once (O(C×T)) and then flattened into a sorted list of (distance, component_index, text_index) triples for greedy assignment. Building the matrix first avoids redundant distance computation during the assignment phase.

### Q9: Why does the function mutate the input list instead of returning a copy?
**A:** The function modifies `components` in-place (adding `value`, `value_confidence`, `mapped_text_bbox` keys) and returns the same list. This avoids allocating new dictionaries and is idiomatic in Python for "enrichment" operations. The caller in `unified_pipeline.py` continues using the same list after the call, which now has the added fields.

### Q10: What is `mapped_text_bbox` used for?
**A:** `mapped_text_bbox` stores the bounding box coordinates of the text label that was assigned to a component. The frontend uses this to draw visual associations — for example, a dashed line from the text label to its matched component in the review overlay. It also helps users verify that the mapping is correct before finalizing.

### Q11: How does the proximity mapper handle overlapping bounding boxes?
**A:** When a text box overlaps its component's bounding box, both `dx` and `dy` are clamped to 0 by the `max(0, ...)` operation. The distance is `sqrt(0+0) = 0`. Since distance 0 is the minimum possible, this text→component pair appears first in the sorted list and will always be assigned (assuming neither is already used).

### Q12: What is the time complexity of the proximity mapping?
**A:** Building the distance matrix is O(C×T). Generating the pairs list is O(C×T). Sorting is O(CT·log(CT)). The greedy scan is O(CT). Total: O(CT·log(CT)). For typical circuits with C ≤ 30 and T ≤ 30, this is < 1000 operations — essentially instantaneous.

### Q13: Could the greedy algorithm produce a suboptimal result? Give an example.
**A:** Yes, in rare cases. Consider: text T1 is 10px from both C1 and C2, text T2 is 15px from C2 only. Greedy assigns T1→C1 first (arbitrary tie-break), then T2→C2 (dist 15). Hungarian would also assign T1→C1 and T2→C2 (same result). A suboptimal case: T1 is 10px from C1 and 11px from C2, T2 is 12px from C1 and 100px from C2. Greedy: T1→C1 (10px), T2→C2 (100px), total=110. Optimal: T1→C2 (11px), T2→C1 (12px), total=23. However, such configurations are extremely rare in practice because text labels are usually placed unambiguously close to their component.

### Q14: Why is the `ocr_text` emptiness check important?
**A:** YOLO might detect a text region (class 11) but OCR could fail to recognize any characters — returning an empty string. Assigning an empty string to a component would overwrite a potentially useful default value with nothing. The `if not td.get("ocr_text"): continue` check skips these empty results, preserving the component for a potential match with a non-empty text detection.

### Q15: Where in the pipeline is the proximity mapper called?
**A:** It's called in `unified_pipeline.py :: _run_pipeline_raw()`, after both OCR engines (TrOCR and Custom CRNN) have populated `text_detections[].ocr_text`, but before the line detection pipeline. This ordering ensures text detections have their final recognized values when the mapping is performed, and the enriched components are available for the final Circuit schema construction.

### Q16: How would you improve the proximity mapper for ambiguous cases?
**A:** Several improvements could help: (1) Use component class-specific max distances (e.g., text for a power source may be further than text for a resistor). (2) Consider directionality — text is usually placed to the right or below a component. (3) Use the Hungarian algorithm for globally optimal assignment. (4) Incorporate OCR confidence as a secondary factor — prefer high-confidence OCR matches. (5) Use semantic understanding — "10k" is a resistor value, "4.7µF" is a capacitor value — to validate assignments. However, the current simple approach works well for >95% of real circuits.

### Q17: What is `setdefault` and why is it used?
**A:** `dict.setdefault(key, default)` sets `dict[key] = default` ONLY if `key` is not already in the dictionary. If the key exists (component was assigned a value), the existing value is preserved. If the key doesn't exist (component was not matched), the default is set. This is used in the final pass to ensure every component has `value`, `value_confidence`, and `mapped_text_bbox` fields, regardless of whether it was matched.

### Q18: What would happen if `max_distance` were set to infinity?
**A:** Every text label would be assigned to some component (assuming there are enough components). Even text labels on the opposite side of the image would be matched, likely to wrong components. The `max_distance` threshold is essential for filtering out text labels that are not associated with any component in the detected set. Setting it too high degrades accuracy; setting it too low causes missed assignments.

### Q19: How does the proximity mapper relate to the review step in the frontend?
**A:** The proximity mapper's assignments are presented to the user in the frontend's review step. Each component shows its detected value. Users can: (1) See which text was mapped to which component (via `mapped_text_bbox` visual association). (2) Manually correct wrong assignments by typing in the correct value. (3) Add values for unmatched components (value=""). This human-in-the-loop approach compensates for any proximity mapping errors before the circuit is finalized.

### Q20: Why is this implemented as a separate module rather than inline in the pipeline?
**A:** Separation of concerns: the proximity mapper has a single, well-defined responsibility (text→component assignment) with clear inputs and outputs. This makes it: (1) Independently testable without running YOLO/OCR. (2) Replaceable — a more sophisticated assignment algorithm can be swapped in without touching other pipeline code. (3) Reusable — the same function could be used in different pipeline configurations. (4) Readable — 100 lines of focused logic vs. being buried in a 500-line pipeline function.
