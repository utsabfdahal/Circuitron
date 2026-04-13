# Line Detection — Skeleton-Based Wire Tracing & Graph Construction

## Table of Contents

1. [Overview](#1-overview)
2. [Pipeline Architecture](#2-pipeline-architecture)
3. [Stage 1: Binary Thresholding](#3-stage-1-binary-thresholding)
4. [Stage 2: Morphological Skeletonization](#4-stage-2-morphological-skeletonization)
5. [Stage 3: Text Region Erasure](#5-stage-3-text-region-erasure)
6. [Stage 4: Dilation and Re-Skeletonization](#6-stage-4-dilation-and-re-skeletonization)
7. [Stage 5: Endpoint Detection](#7-stage-5-endpoint-detection)
8. [Stage 6: Global Endpoint Merging](#8-stage-6-global-endpoint-merging)
9. [Stage 7: Multi-Head BFS Adjacency Graph](#9-stage-7-multi-head-bfs-adjacency-graph)
10. [Stage 8: Internal Edge Removal](#10-stage-8-internal-edge-removal)
11. [Stage 9: Crossover Dissolution](#11-stage-9-crossover-dissolution)
12. [Stage 10: Component-to-Node Linkage](#12-stage-10-component-to-node-linkage)
13. [Connected Components Analysis](#13-connected-components-analysis)
14. [Bézier Curve Extension](#14-bézier-curve-extension)
15. [Diagnostic Visualizations](#15-diagnostic-visualizations)
16. [Output Format](#16-output-format)
17. [Tunable Parameters](#17-tunable-parameters)
18. [File Reference](#18-file-reference)
19. [Viva Questions & Answers](#19-viva-questions--answers)

---

## 1. Overview

The **line detection pipeline** is the core wire-tracing algorithm in CIRCUITRON. It takes a hand-drawn circuit image and YOLO detection results as input, and produces a **graph data structure** representing the electrical connectivity of the circuit: which components are connected to which, through which wires.

### What It Does

```
Input:  Circuit image (pixels) + YOLO bounding boxes
Output: Graph with {nodes, edges, component linkages}

Nodes  = wire endpoints, junction centers, component terminals
Edges  = wire segments connecting two nodes
```

### Why It's Hard

Hand-drawn circuits present several unique challenges:
- **Non-uniform line thickness:** Pen strokes vary from 1–5 pixels wide
- **Noisy backgrounds:** Paper texture, grid lines, pencil smudges
- **Overlapping elements:** Text labels overlap with wires
- **Crossover ambiguity:** Wire crossings vs. wire connections
- **Disconnected segments:** Gaps where pen lifted or faded ink

### Core Algorithms Used

| Algorithm | Purpose |
|---|---|
| Binary thresholding | Separate ink from paper |
| Zhang-Suen skeletonization | Reduce wires to 1-pixel paths |
| Morphological dilation | Bridge small gaps |
| Border intersection detection | Find component terminals |
| Breadth-First Search (BFS) | Trace wire paths between nodes |
| Dot-product pairing | Dissolve crossover ambiguity |

---

## 2. Pipeline Architecture

```
Raw Image (grayscale) + YOLO Label Text
    │
    ├── 1. Binary Thresholding
    │       → Foreground/background separation
    │
    ├── 2. Skeletonization (Zhang-Suen)
    │       → 1-pixel-wide wire centerlines
    │
    ├── 3. Text Region Erasure
    │       → Remove text bounding boxes from skeleton
    │
    ├── 4. Dilation + Re-Skeletonization
    │       → Bridge micro-gaps, clean up
    │
    ├── 5. Endpoint Detection
    │       → Find where wires meet component borders
    │       → Strategy A: Center-snap (junctions)
    │       → Strategy B: Border intersection (components)
    │
    ├── 6. Global Endpoint Merging
    │       → Merge nearby endpoints into single nodes
    │
    ├── 7. Multi-Head BFS Adjacency Graph
    │       → Trace wire paths between all node pairs
    │
    ├── 8. Internal Edge Removal
    │       → Remove false edges through component bodies
    │
    ├── 9. Crossover Dissolution
    │       → Resolve 4-way crossings into 2 through-connections
    │
    ├── 10. Component-to-Node Linkage
    │        → Map graph nodes to component bounding boxes
    │
    └── Output: {nodes, edges, component_map, diagnostic_images}
```

**Entry point:** `analyze(image_bytes, label_text, params)` in `test/pipeline.py`

---

## 3. Stage 1: Binary Thresholding

### Purpose

Convert the grayscale image into a binary (black/white) image where foreground pixels represent ink (components + wires) and background pixels represent paper.

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/otsu_thresholding.png" alt="Otsu's Global Thresholding" width="80%">
</p>
<p align="center"><em>Result of Otsu’s global thresholding: the binary image preserves wires, junctions, and components while eliminating background and illumination variations.</em></p>

### Algorithm

```python
# 1. Light denoising (median blur with kernel=1, essentially a no-op for very clean images)
denoised = cv2.medianBlur(img_original, 1)

# 2. Fixed threshold: pixels < BINARY_THRESH → foreground (255), else → background (0)
_, simple_bin = cv2.threshold(denoised, BINARY_THRESH, 255, cv2.THRESH_BINARY)

# 3. Invert: scikit-image expects True = foreground
inverted = cv2.bitwise_not(simple_bin)
```

### Why Fixed Threshold?

We use a **fixed global threshold** (default: 110) rather than adaptive thresholding (e.g., Otsu's method) because:

1. **User control:** The frontend provides a threshold slider that lets users adjust this value in real-time via the `/re-analyze` endpoint. This is more intuitive than automatic methods that may produce unexpected results.
2. **Consistency:** The same threshold value produces the same results every time, supporting reproducible analysis.
3. **Speed:** Fixed thresholding is O(n) — one comparison per pixel. Adaptive methods like Otsu's require histogram computation plus optimization.

### Threshold Value Selection

- **Too low (< 80):** Only the darkest strokes are captured; faint wires and light pencil marks are missed
- **Optimal (90–130):** Most hand-drawn circuits work well in this range
- **Too high (> 150):** Paper grain and background noise gets included as foreground

The default of 110 was empirically chosen for typical scanned/photographed hand-drawn circuits.

---

## 4. Stage 2: Morphological Skeletonization

### Purpose

Reduce multi-pixel-wide wire strokes into **1-pixel-wide centerlines** (skeletons) that preserve the wire topology.

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/skelotonization.png" alt="Skeletonization" width="80%">
</p>
<p align="center"><em>Morphological skeletonization reduces all lines to single-pixel width while maintaining connectivity and topology of the circuit wires.</em></p>

### Algorithm: Zhang-Suen Thinning

We use `skimage.morphology.skeletonize()` which implements the **Zhang-Suen thinning algorithm**:

```python
skeleton = skeletonize(inverted > 0)  # Returns boolean ndarray
```

#### How Zhang-Suen Works

The algorithm iteratively removes border pixels from the foreground while preserving:
1. **Connectivity:** Never break a connected wire into two disconnected pieces
2. **Topology:** Preserve branch points (junctions) and endpoints

Each iteration performs two sub-iterations:

**Sub-iteration 1:** Mark a pixel for deletion if:
- It's a foreground pixel
- It has 2–6 foreground neighbors (in 8-connectivity)
- The number of 0→1 transitions in its 8-neighborhood is exactly 1 (ensures it's a border pixel, not a branch)
- At least one of {North, East, South} neighbors is background
- At least one of {East, South, West} neighbors is background

**Sub-iteration 2:** Same conditions but the last two checks change to:
- At least one of {North, West, South} is background
- At least one of {North, East, West} is background

The alternating sub-iterations ensure thinning proceeds symmetrically from all sides, producing a centered skeleton.

#### Properties of the Skeleton:
- **Width:** Exactly 1 pixel along all wire paths
- **Topology preserved:** Branch points where 3+ wires meet are maintained
- **Endpoints preserved:** Wire termination points (degree-1 vertices) are maintained
- **Connectivity preserved:** If two regions were connected before, they remain connected

### Why Skeletonization?

Without skeletonization, wires would be 3–5 pixels wide, making it impossible to:
- Determine exact center positions for graph nodes
- Perform clean BFS traversal (which path through a 5-pixel-wide corridor?)
- Detect precise border intersection points at component terminals

---

## 5. Stage 3: Text Region Erasure

### Purpose

Remove all pixels within text-class (YOLO class 11) bounding boxes from the skeleton. Text labels like "10k", "4.7uF" etc. contain ink pixels that would otherwise be mistaken for wires.

### Algorithm

```python
for d in detections_with_bbox:
    if d["cls"] == 11:  # text class
        x1, y1, x2, y2 = d["bbox_xyxy"]
        skeleton[y1:y2, x1:x2] = False  # Zero out entire text region
```

### Why YOLO-Guided Erasure?

Alternatives like edge detection or connected component analysis cannot reliably distinguish text pixels from wire pixels — both are thin dark strokes. By using YOLO's text class detection, we know *exactly* where text is before processing the skeleton. This is a key advantage of our multi-model pipeline: YOLO identifies what each region is, then the line detection pipeline processes only wire-relevant pixels.

### Side Effect: Gap Creation

Erasing text regions may create gaps in wires that passed through or near text. These gaps are addressed in the next stage (dilation + re-skeletonization).

---

## 6. Stage 4: Dilation and Re-Skeletonization

### Purpose

Bridge small gaps created by text erasure or faint ink, then re-skeletonize to restore clean 1-pixel paths.

### Algorithm

```python
# 1. Convert boolean skeleton to uint8 image
img_u8 = skeleton.astype(np.uint8) * 255

# 2. Morphological dilation with 3×3 square kernel (1 iteration)
kernel = np.ones((3, 3), np.uint8)
dilated = cv2.bitwise_not(cv2.dilate(img_u8, kernel, iterations=1))

# 3. Re-binarize
binary_fg = (dilated < 128).astype(np.uint8)

# 4. Re-skeletonize
skel = skeletonize(binary_fg.astype(bool)).astype(np.uint8)
```

### What Dilation Does

**Morphological dilation** expands every foreground pixel by the kernel shape. With a 3×3 square kernel and 1 iteration, each foreground pixel grows by 1 pixel in all 8 directions. This bridges gaps of up to 2 pixels.

```
Before dilation:     After dilation (3×3 kernel):
  ● ● ● · · ● ●       ● ● ● ● ● ● ●
                        ● ● ● ● ● ● ●
                        ● ● ● ● ● ● ●
Gap of 2 pixels → bridged!
```

### Why Re-Skeletonize?

Dilation makes wires 3 pixels wide. Re-skeletonization brings them back to 1 pixel. The resulting skeleton is cleaner than the original because:
1. Micro-gaps from text erasure are now connected
2. Minor pen-lift gaps (1–2 pixels) are bridged
3. The double skeletonization produces smoother centerlines

---

## 7. Stage 5: Endpoint Detection

### Purpose

Determine where each detected component connects to wires. The strategy differs based on the component class.

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/skeleton_with_endpoints.png" alt="Skeleton with Endpoints" width="75%">
</p>
<p align="center"><em>Skeletonized image with all detected endpoints (blue dots) overlaid. Blue rectangles show original YOLO bounding boxes used for endpoint localization.</em></p>

### Strategy A: Center-Snap (Classes 1, 6, 10)

**Applies to:** Crossovers (1), Junctions (6), Terminals (10)

These components represent wire meeting points. Their "endpoint" is the skeleton pixel nearest to the bounding box center.

```python
def _endpoint_for_class1_single(skel, x1, y1, x2, y2, margin=8):
    # 1. Compute bounding box center
    xc = (x1 + x2) / 2
    yc = (y1 + y2) / 2
    
    # 2. Expand search region by margin
    sx1, sy1 = x1 - margin, y1 - margin
    sx2, sy2 = x2 + margin, y2 + margin
    
    # 3. Find all skeleton pixels in expanded region
    # 4. Return nearest to (xc, yc)
```

**Why center-snap?** Junctions and crossovers should be single-point nodes in the graph. Unlike resistors (which have 2 terminals), a junction is one point where multiple wires converge.

### Strategy B: Border Intersection (All Other Classes)

**Applies to:** Resistors, capacitors, diodes, inductors, etc.

These components have **two or more terminals** where wires enter/exit the bounding box. The algorithm finds where the skeleton crosses the bounding box perimeter.

#### Step 1: Extract Border Intersection Pixels

```python
def _skeleton_intersections_with_bbox_border(skel, x1, y1, x2, y2, tol=1):
    # Create an annular mask: the border ring of the bounding box
    # Width = tol pixels (default 1)
    band = zeros_like(skel)
    band[y1-tol : y2+tol, x1-tol : x2+tol] = True  # Outer rectangle
    band[y1+tol : y2-tol, x1+tol : x2-tol] = False  # Exclude inner area
    
    # Find skeleton pixels within the border ring
    return np.where((skel > 0) & band)
```

**Visualization:**

```
┌──────────────────────┐  ← Outer boundary (x1-tol, y1-tol)
│ ████████████████████ │  ← Border band (tol=1 pixel wide)
│ █                  █ │
│ █   (component     █ │  ← Inner area excluded
│ █    body here)    █ │
│ █                  █ │
│ ████████████████████ │
└──────────────────────┘  ← (x2+tol, y2+tol)

● = skeleton pixels in the border band = wire entry/exit points
```

#### Step 2: Cluster Border Pixels

Multiple skeleton pixels may fall on the same terminal (e.g., a slightly diagonal wire crosses 3 consecutive border pixels). These are clustered into single endpoint centroids:

```python
def _get_all_border_intersections(skel, inter_xy, merge_dist=8.0):
    # For each raw point:
    #   If within merge_dist of an existing cluster → average into centroid
    #   Else → start new cluster
    # Return list of cluster centroids
```

**Example:**
```
Raw border pixels:  (100, 50), (101, 50), (102, 50), (200, 50), (201, 50)
Merge distance = 8
Result: (101, 50), (200, 50)  [two clusters → two terminals]
```

### Fallback: Internal Skeleton Search

If no skeleton pixels cross the bounding box border (component body obscures border), the algorithm falls back to searching *inside* the bounding box:

```python
if len(inter) == 0:
    roi = skel_img[y1:y2+1, x1:x2+1]
    ys, xs = np.where(roi > 0)
    pts = [(x1 + xs[i], y1 + ys[i]) for i in range(len(xs))]
    method = "fallback_internal"
```

---

## 8. Stage 6: Global Endpoint Merging

### Purpose

Collect all endpoints from all detections and merge nearby points that represent the same physical junction.

### Algorithm

```python
def _extract_all_endpoints(results, global_merge_dist=5.0):
    all_pts = []
    for r in results:
        # Collect endpoint_xy (single point) and endpoints[] (multiple points)
        if "endpoint_xy" in r and r["endpoint_xy"] is not None:
            all_pts.append(r["endpoint_xy"])
        if "endpoints" in r:
            for ep in r["endpoints"]:
                all_pts.append(ep)
    
    # Merge nearby points
    unique = []
    for pt in all_pts:
        distances = [dist(pt, u) for u in unique]
        if min(distances) > global_merge_dist:
            unique.append(pt)  # New unique node
        # else: already represented by an existing node, skip
    
    return unique  # These become the graph's vertex set
```

### Why Merge?

Two scenarios produce duplicate endpoints:

1. **Shared junction:** A wire endpoint for a resistor and a wire endpoint for a capacitor land on the same junction point — they should be one graph node, not two.
2. **Slight positional drift:** The border intersection for component A yields (100, 50) and the border intersection for component B yields (102, 51). These are within 3 pixels — same physical point.

**Default merge distance:** 5 pixels — balances between merging legitimate duplicates and keeping genuinely separate nearby endpoints distinct.

---

## 9. Stage 7: Multi-Head BFS Adjacency Graph

### Purpose

Determine which nodes are connected by wire paths in the skeleton. This is the **core algorithm** of the entire line detection pipeline.

<p align="center">
  <img src="../circuitron_final_report/src/images/figures/adjacency_graph.png" alt="Adjacency Graph" width="65%">
</p>
<p align="center"><em>Final adjacency graph built via Multi-Head BFS. Blue lines represent wire connectivity between detected endpoints (red nodes). Self-edges and internal-component connections have been pruned.</em></p>

### Overview

For each node, a Breadth-First Search (BFS) starts at the node's location and traces along skeleton pixels until it reaches another node. This builds an adjacency graph where edges represent direct wire connections.

### Step 1: Build Node ID Map

```python
def _build_node_id_map(skel, nodes, radius=25):
    node_id_map = np.full((H, W), -1, dtype=np.int32)
    for i, (nx, ny) in enumerate(nodes):
        for dy, dx in disk_mask(radius):
            py, px = ny + dy, nx + dx
            node_id_map[py, px] = i  # All pixels in disk belong to node i
```

This creates a full-resolution lookup table where each pixel "knows" if it belongs to a node. The disk radius of 25 pixels defines the node's "territory" — a generous margin around each endpoint to ensure the BFS can start and terminate correctly.

**Disk mask:** All `(dy, dx)` offsets within a circle of radius 25:
```python
offsets = [(dy, dx) for dy in range(-25, 26)
                     for dx in range(-25, 26)
                     if dy*dy + dx*dx <= 625]
# Produces ~1,963 offset pairs
```

### Step 2: BFS from Each Node

```python
def _bfs_neighbors_for_node(node_idx, nodes, skel, node_id_map, radius):
    # 1. Mark all pixels in this node's disk as visited
    visited = set()
    for dy, dx in disk_mask(radius):
        py, px = ny + dy, nx + dx
        visited.add((py, px))
    
    # 2. Seed the BFS queue with skeleton pixels just outside the disk
    queue = deque()
    for py, px in visited:  # For each pixel in the disk...
        for npy, npx in neighbors_8(py, px):  # Check 8-connected neighbors
            if (npy, npx) not in visited and skel[npy, npx] > 0:
                visited.add((npy, npx))
                queue.append((npy, npx))
    
    # 3. BFS: trace along skeleton pixels
    neighbors_found = set()
    while queue:
        cy, cx = queue.popleft()
        
        # Check: did we reach another node's territory?
        other_node = node_id_map[cy, cx]
        if other_node != -1 and other_node != node_idx:
            neighbors_found.add(other_node)  # Found a connection!
            continue  # Don't expand further past this node
        
        # Expand to 8-connected skeleton neighbors
        for npy, npx in neighbors_8(cy, cx):
            if (npy, npx) not in visited and skel[npy, npx] > 0:
                visited.add((npy, npx))
                queue.append((npy, npx))
    
    return neighbors_found
```

### How 8-Connectivity Works

```python
def _get_neighbors8(y, x, H, W):
    neighbors = []
    for dy in [-1, 0, 1]:
        for dx in [-1, 0, 1]:
            if dy == 0 and dx == 0: continue
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W:
                neighbors.append((ny, nx))
    return neighbors
```

8-connectivity means each pixel can connect to its 8 neighbors (up, down, left, right, and 4 diagonals). This is essential because:
- Diagonal wires in the skeleton form chains of diagonally adjacent pixels
- 4-connectivity would break these diagonal chains

### Step 3: Symmetrize the Adjacency

```python
adjacency = {i: set() for i in range(len(nodes))}
for i in range(len(nodes)):
    neighbors = _bfs_neighbors_for_node(i, nodes, skel, node_id_map, radius)
    for j in neighbors:
        adjacency[i].add(j)
        adjacency[j].add(i)  # Ensure A→B implies B→A
```

### Why "Multi-Head" BFS?

The BFS is called "Multi-Head" because:
1. It starts from ALL pixels on the node's disk boundary simultaneously (not just one start pixel)
2. It discovers ALL reachable neighbor nodes in a single pass
3. For a node with 3 connections, one BFS run finds all 3 neighbors at once

This is more efficient and reliable than running separate BFS searches toward each potential neighbor.

### Computational Complexity

- **Per node:** O(S) where S is the number of skeleton pixels reachable from that node. Each pixel is visited at most once.
- **Total:** O(N × S) where N is the number of nodes. In practice, most skeleton pixels are visited only ~2 times (once from each end of a wire segment).
- **Why `set` for visited?** Using a Python `set` for visited pixels (rather than a full numpy array) is memory-efficient for sparse skeletons. A circuit image might be 2000×1500 pixels (3M total) but only 20K skeleton pixels.

---

## 10. Stage 8: Internal Edge Removal

### Purpose

Remove false edges that were created by BFS tracing through component bodies.

### The Problem

Consider a resistor with two terminals (node A and node B). The skeleton runs through the resistor symbol, creating a valid BFS path from A to B that runs *through* the component body. This creates a false edge A↔B in the adjacency graph. In the real circuit, A and B are component terminals, not connected by a wire.

```
Node A ─── [RESISTOR BODY] ─── Node B
           (skeleton passes through)

BFS finds: A → B  (false! They're terminals of the SAME component)
```

### Algorithm

```python
for r in results:
    if "endpoints" in r and len(r.get("endpoints", [])) >= 2:
        for (p1, p2) in combinations(r["endpoints"], 2):
            i1 = _find_node_index(p1, all_nodes, FIND_NODE_DIST)
            i2 = _find_node_index(p2, all_nodes, FIND_NODE_DIST)
            if i1 != -1 and i2 != -1:
                adjacency[i1].discard(i2)
                adjacency[i2].discard(i1)
```

For each detection result with 2+ endpoints:
1. Look up the graph node index for each endpoint
2. Remove the edge between them from the adjacency graph
3. Use `combinations(endpoints, 2)` to handle components with 3+ terminals (e.g., transistors)

### `_find_node_index` Helper

```python
def _find_node_index(target_coord, all_nodes, dist_threshold):
    distances = np.linalg.norm(all_nodes - target_coord, axis=1)
    min_idx = np.argmin(distances)
    return min_idx if distances[min_idx] <= dist_threshold else -1
```

Returns the nearest graph node within `dist_threshold` pixels, or `-1` if no node is close enough.

---

## 11. Stage 9: Crossover Dissolution

### Purpose

Resolve wire crossovers (YOLO class 1) — points where two wires visually cross without making an electrical connection. In the skeleton graph, a crossover initially appears as a 4-way junction. Dissolution splits it into two independent through-connections.

### The Problem

```
Before dissolution:          What it should be:

      A                            A
      |                            |
  B───X───C        →           B   |   C  (two separate wires)
      |                            |
      D                        B───┼───C
                                   |
                                   D

Naive graph: X connects to {A, B, C, D} — wrong!
Correct:     A↔D (wire 1), B↔C (wire 2) — no junction
```

### Algorithm: Dot-Product Pairing

```python
def _dissolve_crossovers(results, all_nodes, adjacency, find_dist):
```

**Step 1: Identify candidates**
- Find all class-1 (crossover) detections whose center endpoint maps to a graph node
- Only process nodes with **exactly 4 neighbors** (required for crossover geometry)

**Step 2: Compute direction vectors**
```python
ax, ay = all_nodes[crossover_idx]  # Crossover center
for n_idx in neighbors:
    nx, ny = all_nodes[n_idx]
    v = _normalized_vector(ax, ay, nx, ny)
    # v = unit vector from crossover to neighbor
```

The normalized vector from point A to point B:
$$\vec{v} = \frac{(B_x - A_x, B_y - A_y)}{|(B_x - A_x, B_y - A_y)|}$$

**Step 3: Find optimal pairing**

With 4 neighbors {B, C, D, E}, there are exactly 3 ways to pair them into 2 pairs:
```
Pairing 1: (B,C) + (D,E)
Pairing 2: (B,D) + (C,E)
Pairing 3: (B,E) + (C,D)
```

For each pairing, compute the score:
$$\text{score} = \vec{v}_1 \cdot \vec{v}_2 + \vec{v}_3 \cdot \vec{v}_4$$

where $\vec{v}_1, \vec{v}_2$ are the direction vectors of the first pair, etc.

**Geometric intuition:** The dot product of two unit vectors equals the cosine of the angle between them:
- $\cos(180°) = -1$ — vectors point in opposite directions (what we want for through-connections)
- $\cos(90°) = 0$ — vectors are perpendicular
- $\cos(0°) = +1$ — vectors point in the same direction

The correct pairing has the **most negative** (smallest) score because through-wires are nearly antiparallel.

**Step 4: Validate**

Both pairs must have dot products below **-0.7** (within ~45° of being directly opposite):
```python
DOT_THRESHOLD = -0.7
if dot1 > DOT_THRESHOLD or dot2 > DOT_THRESHOLD:
    continue  # Geometry doesn't confirm a clean crossover
```

**Step 5: Dissolve**
```python
# Remove crossover node and all its edges
for n_idx in neighbors:
    adjacency[n_idx].discard(crossover_idx)
del adjacency[crossover_idx]

# Wire through-connections directly
adjacency[pair1_a].add(pair1_b)
adjacency[pair1_b].add(pair1_a)
adjacency[pair2_a].add(pair2_b)
adjacency[pair2_b].add(pair2_a)
```

### Edge Cases

| Scenario | Behavior |
|---|---|
| Crossover with < 4 neighbors | Kept as-is (treated as junction) |
| Crossover with > 4 neighbors | Kept as-is (ambiguous topology) |
| Neighbors not geometrically opposite (dot > -0.7) | Kept as-is (might be a real junction) |
| YOLO misclassifies junction as crossover | Dot-product check usually catches it (junction neighbors aren't antiparallel) |

---

## 12. Stage 10: Component-to-Node Linkage

### Purpose

After the adjacency graph is finalized, map each graph node to the component(s) whose terminal endpoints touch it. This creates the mapping needed for the `Connection` records in the final Circuit schema.

### Algorithm

```python
def _build_node_component_map(results, all_nodes, adjacency, merge_dist):
    link_dist = merge_dist + 3  # Default: 5 + 3 = 8 pixels
    node_to_components = {i: [] for i in range(len(all_nodes))}
    
    for r_idx, r in enumerate(results):
        # Collect this component's endpoints
        endpoints = []
        if "endpoint_xy" in r: endpoints.append(r["endpoint_xy"])
        if "endpoints" in r:   endpoints.extend(r["endpoints"])
        
        # For each endpoint, find the nearest graph node
        for ep in endpoints:
            best_node = argmin(distance(ep, all_nodes))
            if distance(ep, all_nodes[best_node]) <= link_dist:
                node_to_components[best_node].append(r_idx)
```

### Link Distance

`link_dist = merge_dist + 3 = 8 pixels` — slightly larger than the merge distance to account for small positional offsets between a component's detected endpoint and the nearest graph node.

---

## 13. Connected Components Analysis

### Purpose

Count the number of **connected components** (in the graph theory sense) in the adjacency graph. A fully connected circuit should have exactly 1 connected component. Multiple components indicate disconnected sub-circuits.

### Algorithm

```python
def _count_components(adj):
    visited = set()
    count = 0
    for node in adj:
        if node not in visited:
            count += 1
            # DFS/BFS to mark all reachable nodes
            stack = [node]
            while stack:
                curr = stack.pop()
                if curr not in visited:
                    visited.add(curr)
                    stack.extend(adj[curr] - visited)
    return count
```

This is a standard DFS-based connected component counting algorithm with O(V + E) complexity.

---

## 14. Bézier Curve Extension

**File:** `test/pipelinewithbeizer.py`

The Bézier extension adds smooth curve fitting to the wire paths traced by BFS. Instead of raw pixel paths, each wire segment is represented as a smooth cubic Bézier curve.

### 14.1 BFS Path Tracing

For wire visualization, a second BFS pass traces the actual pixel path between two connected nodes:

```
Node A → [pixel, pixel, pixel, ..., pixel] → Node B
```

This gives a sequence of (x, y) coordinates following the skeleton.

### 14.2 Deviation Analysis

Before fitting a Bézier curve, the algorithm analyzes how much the pixel path deviates from a straight line:

- **Max deviation:** Maximum perpendicular distance from any pixel to the straight line A→B
- **Mean deviation:** Average perpendicular distance
- **Threshold:** If max deviation > threshold → the wire is curved (needs Bézier); else → it's essentially straight (use straight line)

### 14.3 Cubic Bézier Fitting (Least-Squares)

A cubic Bézier curve is defined by 4 control points $P_0, P_1, P_2, P_3$:

$$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3$$

Where $t \in [0, 1]$.

The fitting algorithm:
1. $P_0 =$ start node position, $P_3 =$ end node position (fixed)
2. Assign $t$ values to each BFS path pixel based on cumulative arc length
3. Solve a least-squares system to find $P_1, P_2$ that minimize the sum of squared distances between the Bézier curve and the pixel path

### 14.4 Orthogonal Wire Analysis

For circuit diagrams, wires are typically horizontal or vertical. The pipeline analyzes each path segment to determine if it's predominantly orthogonal (axis-aligned) and represents it accordingly for cleaner schematic rendering.

---

## 15. Diagnostic Visualizations

The pipeline generates 4 diagnostic images (base64-encoded PNGs):

| Stage | Visualization |
|---|---|
| Bounding Box Overlay | Skeleton with Wire Endpoints |
| <img src="../circuitron_final_report/src/images/figures/bounding_box_overlay.png" alt="Bounding Box Overlay" width="400"> | <img src="../circuitron_final_report/src/images/figures/skeletonwithendpointvdivider.png" alt="Skeleton with Endpoints" width="400"> |
| Adjacency Graph | Combined Overlay |
| <img src="../circuitron_final_report/src/images/figures/adjancyvdivider.png" alt="Adjacency Graph" width="400"> | <img src="../circuitron_final_report/src/images/figures/combined_overlay.png" alt="Combined Overlay" width="400"> |

<p align="center"><em>Diagnostic visualizations generated at each stage: bounding box overlay, skeleton with detected endpoints, adjacency graph, and final combined overlay of all pipeline results.</em></p>

### 15.1 Skeleton Image (`skeleton_png`)

Black-on-white rendering of the final skeleton after all processing:
```python
skel_black_on_white = np.ones_like(dilated) * 255
skel_black_on_white[skel_u8 > 0] = 0
```

### 15.2 Overlay Image (`overlay_png`)

Skeleton overlaid with detection bounding boxes and endpoint markers:
- Dark red boxes around each detection
- Red filled circles at detected endpoints
- Blue skeleton lines

### 15.3 Bounding Box Image (`bbox_png`)

Skeleton with color-coded bounding boxes per class:
```python
class_colors = {
    0: (0, 165, 255),    # capacitor – orange
    1: (255, 0, 255),    # crossover – magenta
    2: (0, 255, 0),      # diode – green
    6: (0, 0, 255),      # junction – red
    8: (0, 200, 200),    # resistor – dark yellow
    ...
}
```

### 15.4 Adjacency Graph Image (`adjacency_graph_png`)

Matplotlib scatter plot showing:
- Red dots at each graph node (numbered)
- Blue lines connecting adjacent nodes
- Inverted Y-axis (image coordinate system)

---

## 16. Output Format

The `analyze()` function returns:

```python
{
    "image_size": {"width": 800, "height": 600},
    "detections": [
        {"cls": 8, "name": "resistor", "conf": 0.92, "bbox": [120, 45, 210, 95]},
        ...
    ],
    "results": [
        {
            "cls": 8, "name": "resistor", "conf": 0.92,
            "bbox": [120, 45, 210, 95],
            "method": "all_border_hits_cleaned",
            "endpoints": [[118, 70], [212, 70]]
        },
        {
            "cls": 1, "name": "crossover", "conf": 0.87,
            "bbox": [300, 200, 320, 220],
            "method": "cls1_center_snap",
            "endpoint": [310, 210]
        },
        ...
    ],
    "graph": {
        "nodes": [
            {"id": 0, "x": 118, "y": 70},
            {"id": 1, "x": 212, "y": 70},
            ...
        ],
        "edges": [
            {
                "source": 0, "target": 1,
                "linked_components": {
                    "source_components": [{"cls": 8, "name": "resistor", "bbox": [...]}],
                    "target_components": [{"cls": 0, "name": "capacitor", "bbox": [...]}]
                }
            },
            ...
        ],
        "num_components": 1
    },
    "images": {
        "skeleton_png": "data:image/png;base64,...",
        "overlay_png": "data:image/png;base64,...",
        "bbox_png": "data:image/png;base64,...",
        "adjacency_graph_png": "data:image/png;base64,..."
    }
}
```

### Method Values

| Method | Description |
|---|---|
| `cls1_center_snap` | Junction/crossover/terminal: nearest skeleton pixel to bbox center |
| `all_border_hits_cleaned` | Standard component: border intersection + clustering |
| `fallback_internal` | No border hits found; used internal skeleton pixels |
| `cls1_not_found` | Junction center-snap failed (no skeleton pixels nearby) |
| `no_border_hits` | Border intersection returned empty (component isolated from wires) |

---

## 17. Tunable Parameters

All parameters can be overridden via the `params` dict:

| Parameter | Default | Effect of Increase | Effect of Decrease |
|---|---|---|---|
| `binary_thresh` | 110 | More aggressive binarization; captures faint lines but adds noise | Only captures dark strokes; may miss faint wires |
| `node_radius` | 25 | Larger node territories; BFS starts further from endpoints | Smaller territories; may miss connections |
| `cls1_margin` | 8 | Wider search area for junction center-snap | Tighter search; may fail for offset junctions |
| `border_tol` | 1 | Wider border band; captures more intersection pixels | Narrower band; may miss tangential wire crossings |
| `global_merge_dist` | 5 | More aggressive merging; fewer nodes but risk losing distinct junctions | Less merging; more nodes but risk duplicate junctions |
| `find_node_dist_thresh` | 5 | Lenient node matching; may cause false internal edge removal | Strict matching; may keep false internal edges |
| `skel_thresh` | 128 | Reserved (currently unused in the pipeline) | — |

---

## 18. File Reference

| File | Role |
|---|---|
| `test/pipeline.py` | Main line detection pipeline (`analyze()`) |
| `test/pipelinewithbeizer.py` | Extended pipeline with Bézier curve fitting |
| `crossoverhandling/pipeline.py` | Enhanced version with step-by-step debug visualizations | 
| `crossoverhandling/CROSSOVER_HANDLING.md` | Crossover algorithm documentation |

---

## 19. Viva Questions & Answers

### Q1: What is morphological skeletonization and why is it used?
**A:** Morphological skeletonization (Zhang-Suen thinning) iteratively erodes border pixels from foreground regions until only 1-pixel-wide centerlines remain. It preserves the topology — branch points and endpoints are maintained, and connectivity is never broken. We use it to convert multi-pixel-wide wire strokes into thin paths that can be precisely traced by BFS. Without skeletonization, wires are 3–5 pixels wide, making it impossible to determine exact vertex positions or perform clean graph traversal.

### Q2: Why BFS instead of DFS for wire tracing?
**A:** BFS (Breadth-First Search) explores pixels layer by layer from the starting node. This is preferable to DFS because: (1) BFS starts from ALL boundary pixels of a node's disk simultaneously, so it can trace multiple wires leaving a node in parallel. (2) BFS discovers the nearest neighbor first, which helps prevent tracing past a close neighbor to reach a distant one. (3) BFS's level-order traversal is more predictable and easier to reason about for correctness. DFS would follow one wire to completion before exploring others, potentially causing issues at branch points.

### Q3: What is the node_id_map and why is it needed?
**A:** The `node_id_map` is a full-resolution (H×W) integer array where each pixel stores the index of the node it belongs to (-1 if it doesn't belong to any node). When BFS reaches a pixel, it checks `node_id_map` in O(1) to determine if it has arrived at another node's territory. Without this map, BFS would need to compute distances to all nodes at every step, which would be O(N) per pixel — far too slow.

### Q4: How does the crossover dissolution algorithm work?
**A:** The algorithm identifies crossover nodes (class 1) with exactly 4 neighbors in the adjacency graph. For each crossover, it computes unit direction vectors from the crossover center to each neighbor. It then tries all 3 ways to pair the 4 neighbors into 2 pairs, scoring each pairing by the sum of dot products within pairs. The best pairing is the one with the most negative score (pairs of neighbors that are most geometrically opposite). If both pairs have dot products < -0.7 (confirming near-antiparallel alignment), the crossover node is removed and direct edges are created between paired neighbors.

### Q5: What is the dot product and how is it used for crossover pairing?
**A:** The dot product of two unit vectors equals the cosine of the angle between them: $\vec{u} \cdot \vec{v} = \cos\theta$. For crossover dissolution, we want to pair neighbors that are on opposite sides of the crossover (angle ≈ 180°, dot product ≈ -1). The threshold of -0.7 corresponds to $\cos^{-1}(-0.7) \approx 134°$, meaning pairs must be within ~46° of being directly opposite. This is lenient enough to handle slightly curved wires while strict enough to reject perpendicular neighbors.

### Q6: Why do you erase text regions before building the wire graph?
**A:** Text labels like "10k" or "4.7uF" contain ink pixels that would be included in the skeleton if not erased. These text pixels would create false wire connections between unrelated parts of the circuit. By using YOLO's text class (class 11) bounding boxes to blank out text regions, we ensure the skeleton contains only wire and component pixels. The small gaps created by erasure are bridged in the subsequent dilation + re-skeletonization step.

### Q7: What happens when a wire endpoint isn't detected correctly?
**A:** Three fallback mechanisms handle missed endpoints: (1) If no border intersection pixels are found, the algorithm searches for skeleton pixels anywhere inside the component's bounding box (`fallback_internal` method). (2) The global merge step (stage 6) can absorb slight positional errors by merging nearby endpoints. (3) The BFS uses a generous node_radius of 25 pixels, so even if an endpoint is slightly offset, the BFS can still discover the connection.

### Q8: What is the significance of `num_components` in the output?
**A:** `num_components` is the number of connected components in the adjacency graph (graph theory sense). A complete, correctly parsed circuit should have `num_components = 1` (all parts connected). Multiple components indicate: (1) The circuit has intentional separate sections (e.g., input stage and output stage with no direct connection). (2) A wire connection was missed by the line detection (gap in the drawing, low contrast, or occlusion by other elements). Users can see this value and adjust the binary threshold to try to bridge missed connections.

### Q9: How do you handle T-junction vs. crossover ambiguity?
**A:** T-junctions (where one wire terminates at another wire) produce nodes with 3 neighbors, not 4. The crossover dissolution only activates for nodes with exactly 4 neighbors. So T-junctions are naturally handled as regular junction nodes (wires DO connect there). Cross-junctions (where 4 wires genuinely connect) would fail the dot-product test because the wires converge at the junction rather than passing through.

### Q10: Why is the binary threshold user-adjustable?
**A:** Different hand-drawn circuits have different ink density, paper brightness, and contrast levels. A photograph taken in dim lighting needs a lower threshold; a high-contrast scan needs a higher one. The frontend provides a slider that calls the `/re-analyze` endpoint, which re-runs ONLY the line detection (stages 1–10) with the new threshold — skipping the expensive YOLO and OCR steps. This gives users instant feedback to find the optimal threshold for their specific image.

### Q11: What is morphological dilation and why do you dilate then re-skeletonize?
**A:** Morphological dilation expands each foreground pixel by a structuring element (3×3 square in our case). This bridges 1–2 pixel gaps in the skeleton caused by text erasure or faint ink. After dilation, wires are ~3 pixels wide, so we re-skeletonize to return to 1-pixel-wide paths. The dilate-then-reskeletonize technique is a standard morphological operation for gap bridging while maintaining topological consistency.

### Q12: What is the time complexity of the line detection pipeline?
**A:** The dominant step is BFS adjacency construction. For N nodes, each BFS visit at most S skeleton pixels. Total: O(N × S). For a typical circuit with ~20 nodes and ~20,000 skeleton pixels, this takes 50–200ms. Skeletonization is O(P × I) where P is foreground pixels and I is iterations (typically 30–100). The entire pipeline runs in 200–500ms for a standard circuit image on CPU.

### Q13: How does the internal edge removal work?
**A:** When a resistor has two terminals (node A and node B), BFS traces the skeleton through the resistor body and creates an edge A↔B. This is wrong — A and B are component terminals, not wire-connected. The internal edge removal step iterates over all detection results. For each result with 2+ endpoints, it finds the corresponding graph nodes and removes the edge between them using `adjacency[i].discard(j)`.

### Q14: What is 8-connectivity and why is it used instead of 4-connectivity?
**A:** 4-connectivity considers only the 4 orthogonal neighbors (up, down, left, right). 8-connectivity additionally includes the 4 diagonal neighbors. Skeleton pixels of diagonal wires are connected diagonally — each pixel touches the next only at corners. 4-connectivity would treat these as disconnected. 8-connectivity correctly traces diagonal wire paths, which are common in hand-drawn circuits where wires aren't perfectly horizontal/vertical.

### Q15: How does the border intersection detection handle diagonal wires?
**A:** A diagonal wire crossing a bounding box border produces multiple adjacent border pixels along the diagonal. The clustering step (`_get_all_border_intersections`) with `merge_dist=8` merges these into a single centroid. For example, a 45° wire crossing the right edge might produce pixels at (200, 48), (200, 49), (200, 50) — all within 8 pixels, so they merge into one endpoint at (200, 49).

### Q16: What is a Bézier curve and how is it fitted to wire paths?
**A:** A cubic Bézier curve is a parametric curve defined by 4 control points: $B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3$, where $t \in [0, 1]$. $P_0$ and $P_3$ are the start and end nodes (fixed). $P_1$ and $P_2$ are computed via least-squares fitting to minimize the distance between the Bézier curve and the actual pixel path traced by BFS. Bézier curves produce smooth, visually clean wire representations for the schematic output.

### Q17: Why do you use a sparse visited set instead of a full numpy array for BFS?
**A:** The skeleton is sparse — typically only 0.3–1% of image pixels are skeleton pixels. A full numpy boolean array for `visited` would allocate H×W bytes (e.g., 3MB for a 2000×1500 image) even though most elements are never touched. A Python `set` of (y, x) tuples only stores the ~20,000 pixels actually visited. For sparse graphs, the set is both faster (hash-based O(1) lookup) and more memory-efficient.

### Q18: What would cause the pipeline to fail?
**A:** Common failure modes: (1) **Threshold too low/high:** Either captures too much noise or misses too many wires. (2) **Touching components:** If two component bounding boxes overlap, their endpoints may be incorrectly merged. (3) **Very faded ink:** Gaps > 2 pixels can't be bridged by the 3×3 dilation kernel. (4) **Complex crossover geometry:** Crossovers with non-orthogonal wires may fail the dot-product threshold. (5) **Dense circuits:** Many overlapping wires may confuse BFS routing.

### Q19: How does the `/re-analyze` endpoint use the line detection pipeline?
**A:** The `/re-analyze` endpoint re-runs ONLY `pipeline.analyze()` with a new `binary_thresh` value. It reuses the cached YOLO label text and image bytes from the previous `/analyze` call (stored in `_session_cache`). This skips the expensive YOLO detection (~200ms) and OCR (~50–500ms), running only the cheap skeleton + BFS pipeline (~200–500ms). The frontend gets updated skeleton and graph visualizations almost instantly.

### Q20: What is the significance of the `node_radius` parameter?
**A:** `node_radius` (default: 25) defines the circular territory around each graph node in the node_id_map. During BFS: (1) All pixels within the radius are marked as "visited" before BFS starts — this prevents BFS from re-entering the source node's territory. (2) When BFS reaches pixels within another node's radius, it records that node as a neighbor and stops expanding. The radius must be large enough to cover the component terminal region but small enough to avoid overlapping with nearby nodes. 25 pixels works well for standard circuit drawing scale.
