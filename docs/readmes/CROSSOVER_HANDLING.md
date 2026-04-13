# Crossover Handling in CIRCUITRON

## Overview

In hand-drawn circuit diagrams, a **crossover** represents two wires that cross each other **without making an electrical connection**. This is distinct from a **junction**, where wires meet and connect. Correctly distinguishing crossovers from junctions is critical for accurate circuit reconstruction.

CIRCUITRON handles crossovers through a multi-stage process spanning YOLO detection, skeleton-based line analysis, and a dedicated **crossover dissolution algorithm**.

---

## Stage 1: YOLO Detection

The YOLOv7 model is trained on 15 component classes. Crossovers are detected as **class index 1** (`"crossover"`). During detection, each crossover produces a bounding box with a confidence score, just like any other component.

In the pipeline, crossovers are grouped with **junctions** (class 6) and **terminals** (class 10) — all three represent topological connection points rather than active electrical components:

```python
junction_dets = [
    d for d in all_detections
    if d["name"] in ("junction", "crossover", "terminal")
]
```

This means crossovers are **excluded from OCR processing and proximity mapping**, since they carry no associated text labels (e.g., resistance values).

---

## Stage 2: Skeleton-Based Endpoint Extraction

After YOLO detection, the pipeline performs **morphological skeletonization** on the binary wire image to extract single-pixel-wide wire paths.

Crossovers receive **special endpoint handling** compared to regular components:

- **Regular components** (resistors, capacitors, etc.): multiple endpoints are extracted where the skeleton crosses the bounding box border, representing the component's terminals.
- **Crossovers, junctions, and terminals** (`cls` in `{1, 6, 10}`): a **single endpoint** is extracted at the bounding box center, snapped to the nearest skeleton pixel.

```python
if d["cls"] in (1, 6, 10):  # crossover, junction, terminal
    ep, method = _endpoint_for_class1_single(
        skel_img, x1, y1, x2, y2, margin=CLS1_MARGIN
    )
```

This single-point representation allows the crossover to serve as a **graph node** connected to all four incoming wire segments, which is then resolved in the next stage.

---

## Stage 3: Adjacency Graph Construction

Using the extracted endpoints, a **Multi-Head BFS** (Breadth-First Search) traces along skeleton pixels to discover which endpoints are connected by wire paths. This produces an **adjacency graph** where:

- **Nodes** = component endpoints, junction centers, crossover centers
- **Edges** = wire segments connecting two nodes

At this point, a crossover node typically has **4 neighbors** — the two wire segments that pass through it.

---

## Stage 4: Crossover Dissolution Algorithm

This is the key step that differentiates crossovers from junctions. The `_dissolve_crossovers` function identifies and removes crossover nodes, replacing them with direct through-connections:

### Algorithm

1. **Identify candidates**: Only nodes with `cls == 1` (crossover) and **exactly 4 neighbors** qualify for dissolution.

2. **Compute direction vectors**: For each of the 4 neighbors, compute a unit direction vector from the crossover center to the neighbor's position.

3. **Find optimal pairing**: Test all three possible ways to pair the 4 neighbors into 2 pairs. Score each pairing using the **dot product** of direction vectors within each pair — the best pairing maximizes how "opposite" the paired neighbors are (i.e., the most negative dot products).

4. **Validate crossing geometry**: Check that both pairs in the best pairing have a dot product below **−0.7**, confirming the paired neighbors lie on roughly opposite sides of the crossover (within ~45° of being directly opposite).

5. **Dissolve**: If validation passes:
   - Remove the crossover node from the graph
   - Create two new direct edges connecting each pair of opposite neighbors
   - The 4-way junction is eliminated from the electrical topology

### Visual Example

```
Before dissolution:          After dissolution:

      A                            A
      |                            |
  B---X---C        →           B   |   C
      |                        |   |   |
      D                        B───┼───C
                                   |
                                   D

  X = crossover node          Two independent wires:
  4 neighbors: A,B,C,D        A↔D (vertical) and B↔C (horizontal)
```

### Edge Cases

- **Fewer than 4 neighbors**: The crossover is treated as a regular junction (wires do connect). This handles cases where the YOLO detector misclassifies a junction as a crossover, or where a wire terminates at the crossing point.
- **Neighbors not geometrically opposite**: If the dot-product check fails (neighbors aren't roughly aligned in two opposing pairs), the crossover is kept as a junction node, preserving connectivity.

---

## Stage 5: Final Circuit Assembly

After dissolution, the crossover node no longer exists in the graph. The final `Circuit` schema contains:

- **Nodes**: Built from the post-dissolution skeleton graph, so crossover points are absent
- **Edges**: Represent the true wire paths — two separate through-connections instead of a 4-way junction
- **Connections**: Components are linked to nodes that fall within their bounding boxes; crossover neighbors now connect directly to each other

The result is a circuit topology that correctly represents **two wires crossing without connecting**, matching the physical intent of the hand-drawn diagram.

---

## Summary Table

| Pipeline Stage | Crossover Treatment |
|---|---|
| YOLO Detection | Detected as class 1, grouped with junctions/terminals |
| OCR & Proximity | Skipped (no text labels) |
| Skeleton Endpoints | Single center-point endpoint |
| Adjacency Graph | Node with 4 neighbors |
| Dissolution | Removed; 2 direct through-connections created |
| Final Circuit | Absent from topology; wires pass through independently |
