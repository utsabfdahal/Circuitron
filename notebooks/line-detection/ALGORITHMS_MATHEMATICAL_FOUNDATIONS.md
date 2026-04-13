# Mathematical Foundations of Skeleton-Based Graph Extraction from Raster Images

## A Rigorous Treatment of Morphological Operators, Topological Thinning, and Graph-Theoretic Reconstruction

---

## Abstract

This document presents a comprehensive mathematical treatment of the algorithms employed in extracting graph-theoretic representations from raster images of circuit diagrams. We formalize the complete pipeline from image acquisition through morphological preprocessing, adaptive thresholding via inter-class variance maximization, topological skeleton extraction through iterative erosion with connectivity preservation, endpoint detection via degree analysis on discrete lattices, and finally graph construction through breadth-first traversal on 8-connected pixel manifolds. Each algorithm is presented with rigorous mathematical definitions, proofs of correctness where applicable, and complexity analysis.

---

## Table of Contents

1. [Preliminary Definitions and Notation](#1-preliminary-definitions-and-notation)
2. [Median Filtering: Order-Statistic Operators on Discrete Lattices](#2-median-filtering-order-statistic-operators-on-discrete-lattices)
3. [Otsu's Method: Optimal Thresholding via Inter-Class Variance Maximization](#3-otsus-method-optimal-thresholding-via-inter-class-variance-maximization)
4. [Morphological Skeletonization: Topological Thinning and the Medial Axis Transform](#4-morphological-skeletonization-topological-thinning-and-the-medial-axis-transform)
5. [Morphological Dilation: Minkowski Addition on Binary Images](#5-morphological-dilation-minkowski-addition-on-binary-images)
6. [Endpoint Detection via Topological Degree Analysis](#6-endpoint-detection-via-topological-degree-analysis)
7. [Graph Construction via BFS on 8-Connected Pixel Manifolds](#7-graph-construction-via-bfs-on-8-connected-pixel-manifolds)
8. [Connected Component Analysis and Graph-Theoretic Properties](#8-connected-component-analysis-and-graph-theoretic-properties)
9. [Computational Complexity Analysis](#9-computational-complexity-analysis)
10. [References](#10-references)

---

## 1. Preliminary Definitions and Notation

### 1.1 Image Domain and Function Spaces

Let $\Omega \subset \mathbb{Z}^2$ denote a finite rectangular lattice representing the image domain:

$$\Omega = \{(x, y) \in \mathbb{Z}^2 : 0 \leq x < W, \ 0 \leq y < H\}$$

where $W, H \in \mathbb{N}$ are the image width and height respectively.

**Definition 1.1 (Grayscale Image).** A grayscale image is a function $I: \Omega \to \mathcal{L}$ where $\mathcal{L} = \{0, 1, \ldots, L-1\}$ is the set of intensity levels, typically with $L = 256$ for 8-bit images.

**Definition 1.2 (Binary Image).** A binary image is a function $B: \Omega \to \{0, 1\}$, or equivalently, a characteristic function of a subset $S \subseteq \Omega$:

$$B(p) = \mathbf{1}_S(p) = \begin{cases} 1 & \text{if } p \in S \\ 0 & \text{otherwise} \end{cases}$$

### 1.2 Neighborhood Systems and Connectivity

**Definition 1.3 (4-Neighborhood).** The 4-neighborhood of a pixel $p = (x, y) \in \Omega$ is:

$$\mathcal{N}_4(p) = \{(x \pm 1, y), (x, y \pm 1)\} \cap \Omega$$

**Definition 1.4 (8-Neighborhood).** The 8-neighborhood of a pixel $p = (x, y) \in \Omega$ is:

$$\mathcal{N}_8(p) = \{(x + i, y + j) : i, j \in \{-1, 0, 1\}, (i,j) \neq (0,0)\} \cap \Omega$$

The 8-neighborhood includes diagonal adjacencies and forms the basis for skeleton connectivity in this work.

**Definition 1.5 (k-Connectivity).** Two pixels $p, q \in \Omega$ are *k-connected* (for $k \in \{4, 8\}$) if there exists a sequence of pixels $p = p_0, p_1, \ldots, p_n = q$ such that $p_{i+1} \in \mathcal{N}_k(p_i)$ for all $i$.

### 1.3 Structuring Elements

**Definition 1.6 (Structuring Element).** A structuring element is a subset $\mathcal{S} \subseteq \mathbb{Z}^2$ with a designated origin, typically $(0,0)$. Common structuring elements include:

- **Square:** $\mathcal{S}_{3\times3} = \{-1, 0, 1\}^2$
- **Disk of radius $r$:** $\mathcal{D}_r = \{(x, y) \in \mathbb{Z}^2 : x^2 + y^2 \leq r^2\}$

---

## 2. Median Filtering: Order-Statistic Operators on Discrete Lattices

### 2.1 Theoretical Foundation

Median filtering belongs to the class of *order-statistic filters*, which are nonlinear operators based on ranking pixel intensities within a local neighborhood.

**Definition 2.1 (Order Statistics).** Given a multiset $\{x_1, x_2, \ldots, x_n\}$ of real values, the *order statistics* $x_{(1)} \leq x_{(2)} \leq \cdots \leq x_{(n)}$ are the values arranged in non-decreasing order.

**Definition 2.2 (Median Filter).** For a grayscale image $I: \Omega \to \mathcal{L}$ and a window $W_p$ centered at pixel $p$, the median filter $\mathcal{M}$ is defined as:

$$\mathcal{M}[I](p) = \text{median}\{I(q) : q \in W_p \cap \Omega\}$$

For a window of size $(2k+1) \times (2k+1)$ containing $n = (2k+1)^2$ pixels, the median is:

$$\text{median}(x_1, \ldots, x_n) = x_{(\lceil n/2 \rceil)}$$

### 2.2 Robustness Properties

**Theorem 2.1 (Breakdown Point of Median).** The median has a breakdown point of $\epsilon^* = 0.5$, meaning that up to 50% of the observations can be arbitrarily corrupted without affecting the median unboundedly.

*Proof.* Let $X = \{x_1, \ldots, x_n\}$ be the original sample with median $m$. Replace $k < n/2$ values with arbitrary values to obtain $X'$. The median of $X'$ lies between $x_{(\lceil n/2 \rceil - k)}$ and $x_{(\lfloor n/2 \rfloor + k)}$ from the original sample. Since $k < n/2$, these bounds remain finite. $\square$

### 2.3 Salt-and-Pepper Noise Model

**Definition 2.3.** Salt-and-pepper noise corrupts each pixel independently with probability $p$:

$$I'(x,y) = \begin{cases} 
0 & \text{with probability } p/2 \\
L-1 & \text{with probability } p/2 \\
I(x,y) & \text{with probability } 1-p
\end{cases}$$

**Theorem 2.2.** For salt-and-pepper noise with corruption probability $p < 0.5$ in a $(2k+1) \times (2k+1)$ window, the median filter perfectly reconstructs the original signal with probability:

$$P(\text{perfect reconstruction}) = \sum_{i=0}^{\lfloor n/2 \rfloor} \binom{n}{i} p^i (1-p)^{n-i}$$

This probability approaches 1 as $n \to \infty$ for any fixed $p < 0.5$.

### 2.4 Edge-Preserving Properties

Unlike linear filters (e.g., Gaussian), the median filter preserves edges while removing impulsive noise. Formally:

**Theorem 2.3 (Edge Preservation).** Let $I$ be a step edge: $I(x,y) = a$ for $x < 0$ and $I(x,y) = b$ for $x \geq 0$. Then the median-filtered output $\mathcal{M}[I]$ is also a step edge at the same location.

*Proof.* For any pixel at position $x < -k$, the entire window contains only value $a$, so the median is $a$. Similarly for $x > k$. For pixels at the edge, the median selects the majority value, preserving the step structure. $\square$

---

## 3. Otsu's Method: Optimal Thresholding via Inter-Class Variance Maximization

### 3.1 Problem Formulation

Given a grayscale image $I: \Omega \to \{0, 1, \ldots, L-1\}$, we seek a threshold $t^* \in \{0, \ldots, L-1\}$ that optimally separates the image into foreground and background.

**Definition 3.1 (Histogram and Probability Distribution).** The normalized histogram of $I$ is:

$$p_i = \frac{|\{p \in \Omega : I(p) = i\}|}{|\Omega|}, \quad i = 0, 1, \ldots, L-1$$

where $\sum_{i=0}^{L-1} p_i = 1$.

### 3.2 Class Statistics

For a threshold $t$, define the two classes:
- **Class 0 (Background):** pixels with intensity $\leq t$
- **Class 1 (Foreground):** pixels with intensity $> t$

**Definition 3.2 (Class Probabilities).**

$$\omega_0(t) = \sum_{i=0}^{t} p_i, \quad \omega_1(t) = \sum_{i=t+1}^{L-1} p_i = 1 - \omega_0(t)$$

**Definition 3.3 (Class Means).**

$$\mu_0(t) = \frac{1}{\omega_0(t)} \sum_{i=0}^{t} i \cdot p_i, \quad \mu_1(t) = \frac{1}{\omega_1(t)} \sum_{i=t+1}^{L-1} i \cdot p_i$$

**Definition 3.4 (Global Mean).**

$$\mu_T = \sum_{i=0}^{L-1} i \cdot p_i = \omega_0(t)\mu_0(t) + \omega_1(t)\mu_1(t)$$

### 3.3 Variance Decomposition

**Theorem 3.1 (Total Variance Decomposition).** The total variance $\sigma_T^2$ decomposes as:

$$\sigma_T^2 = \sigma_W^2(t) + \sigma_B^2(t)$$

where:

- **Within-class variance:** $\sigma_W^2(t) = \omega_0(t)\sigma_0^2(t) + \omega_1(t)\sigma_1^2(t)$
- **Between-class variance:** $\sigma_B^2(t) = \omega_0(t)\omega_1(t)[\mu_0(t) - \mu_1(t)]^2$

*Proof.* By the law of total variance:
$$\sigma_T^2 = \mathbb{E}[\text{Var}(I|C)] + \text{Var}(\mathbb{E}[I|C])$$
where $C$ is the class indicator. The first term equals $\sigma_W^2$ and the second equals $\sigma_B^2$. $\square$

### 3.4 Otsu's Criterion

**Definition 3.5 (Otsu's Optimal Threshold).** The optimal threshold maximizes the between-class variance:

$$t^* = \arg\max_{t \in \{0, \ldots, L-1\}} \sigma_B^2(t)$$

Equivalently, since $\sigma_T^2$ is constant, this minimizes within-class variance.

**Theorem 3.2 (Computational Simplification).** The between-class variance can be expressed as:

$$\sigma_B^2(t) = \frac{[\mu_T \omega_0(t) - \mu(t)]^2}{\omega_0(t)(1 - \omega_0(t))}$$

where $\mu(t) = \sum_{i=0}^{t} i \cdot p_i$ is the cumulative mean.

This allows $O(L)$ computation via single-pass cumulative sums.

### 3.5 Discriminant Criterion

**Definition 3.6.** The *discriminant criterion* $\eta$ measures the "goodness" of the threshold:

$$\eta(t) = \frac{\sigma_B^2(t)}{\sigma_T^2}$$

**Theorem 3.3.** The discriminant criterion satisfies $0 \leq \eta(t) \leq 1$, with $\eta(t^*) = 1$ if and only if the image is bimodal with perfectly separable classes.

---

## 4. Morphological Skeletonization: Topological Thinning and the Medial Axis Transform

### 4.1 The Continuous Medial Axis

**Definition 4.1 (Medial Axis).** For a closed set $X \subset \mathbb{R}^2$, the *medial axis* $M(X)$ is the locus of centers of maximal inscribed disks:

$$M(X) = \{p \in X : \exists r > 0 \text{ such that } D_r(p) \subseteq X \text{ is maximal}\}$$

where $D_r(p)$ is the closed disk of radius $r$ centered at $p$, and "maximal" means no larger disk containing $p$ fits inside $X$.

### 4.2 Distance Transform Foundation

**Definition 4.2 (Euclidean Distance Transform).** For a binary image $B$ with foreground $S = \{p : B(p) = 1\}$, the distance transform is:

$$\text{DT}(p) = \min_{q \in \partial S} \|p - q\|_2$$

where $\partial S$ is the boundary of $S$.

**Theorem 4.1.** The medial axis consists of points where the distance transform has multiple nearest boundary points:

$$M(S) = \{p \in S : |\arg\min_{q \in \partial S} \|p - q\|_2| > 1\}$$

### 4.3 Discrete Skeletonization via Iterative Thinning

In the discrete setting, we employ the *Zhang-Suen thinning algorithm*, which iteratively removes boundary pixels while preserving:
1. **Connectivity** (8-connectivity of the skeleton)
2. **End-point preservation** (pixels with only one neighbor)

**Definition 4.3 (Crossing Number).** For a pixel $p$ with 8-neighbors $\{n_1, \ldots, n_8\}$ arranged clockwise, the crossing number is:

$$\text{CN}(p) = \frac{1}{2}\sum_{i=1}^{8} |B(n_{i+1}) - B(n_i)|$$

where indices are cyclic ($n_9 = n_1$).

**Theorem 4.2 (Connectivity Characterization).**
- $\text{CN}(p) = 1$: $p$ is an endpoint
- $\text{CN}(p) = 2$: $p$ is on a curve
- $\text{CN}(p) \geq 3$: $p$ is at a junction

**Algorithm 4.1 (Zhang-Suen Thinning).**

Each iteration consists of two sub-iterations. In sub-iteration 1, remove pixel $p$ if:
1. $2 \leq N(p) \leq 6$ (number of non-zero neighbors)
2. $\text{CN}(p) = 1$
3. $n_2 \cdot n_4 \cdot n_6 = 0$
4. $n_4 \cdot n_6 \cdot n_8 = 0$

In sub-iteration 2, conditions 3 and 4 become:
3'. $n_2 \cdot n_4 \cdot n_8 = 0$
4'. $n_2 \cdot n_6 \cdot n_8 = 0$

**Theorem 4.3 (Skeleton Properties).** The Zhang-Suen skeleton satisfies:
1. **Thinness:** All skeleton pixels have $N(p) \leq 2$ except at junctions
2. **Connectivity preservation:** 8-connectivity of the original shape is preserved
3. **Homotopy equivalence:** The skeleton is homotopy equivalent to the original shape

### 4.4 Skeleton as a Graph Structure

The skeleton naturally induces a graph $G = (V, E)$ where:
- $V$ = junction points (CN $\geq 3$) $\cup$ endpoints (CN $= 1$)
- $E$ = paths of curve points (CN $= 2$) connecting elements of $V$

---

## 5. Morphological Dilation: Minkowski Addition on Binary Images

### 5.1 Definition and Properties

**Definition 5.1 (Minkowski Sum).** For sets $A, B \subset \mathbb{Z}^2$:

$$A \oplus B = \{a + b : a \in A, b \in B\}$$

**Definition 5.2 (Morphological Dilation).** For a binary image $X$ and structuring element $S$:

$$\delta_S(X) = X \oplus S = \bigcup_{s \in S} X_s$$

where $X_s = \{x + s : x \in X\}$ is $X$ translated by $s$.

### 5.2 Algebraic Properties

**Theorem 5.1 (Dilation Properties).**
1. **Commutativity:** $X \oplus S = S \oplus X$
2. **Associativity:** $(X \oplus S_1) \oplus S_2 = X \oplus (S_1 \oplus S_2)$
3. **Increasing:** $X \subseteq Y \Rightarrow X \oplus S \subseteq Y \oplus S$
4. **Translation invariance:** $(X + t) \oplus S = (X \oplus S) + t$

### 5.3 Dilation as Morphological Closing Component

In the pipeline, dilation is used to close small gaps in the skeleton before re-skeletonization. The closing operation $\phi_S(X) = \delta_S(\epsilon_S(X))$ (dilation followed by erosion) fills holes smaller than $S$ while preserving structure.

**Theorem 5.2 (Gap Closing).** For a skeleton with gap of width $g$, dilation with a disk $\mathcal{D}_r$ where $r \geq g/2$ bridges the gap.

---

## 6. Endpoint Detection via Topological Degree Analysis

### 6.1 Degree-Based Classification

For skeleton endpoints and line segment detection, we analyze the local topology of skeleton pixels.

**Definition 6.1 (Pixel Degree).** For a skeleton image $S$ and pixel $p$, the degree is:

$$\deg(p) = |\{q \in \mathcal{N}_8(p) : S(q) = 1\}|$$

**Classification:**
- $\deg(p) = 1$: **Endpoint** (terminus of a branch)
- $\deg(p) = 2$: **Curve point** (interior of a branch)
- $\deg(p) \geq 3$: **Junction** (branch point)

### 6.2 Bounding Box Border Intersection

For detected line segments (YOLO class 2), we find skeleton endpoints at the bounding box border.

**Definition 6.2 (Border Band).** For bounding box $[x_1, x_2] \times [y_1, y_2]$ and tolerance $\tau$:

$$\mathcal{B}_\tau = \{(x,y) : d_\infty((x,y), \partial\text{Box}) \leq \tau\}$$

where $d_\infty$ is the Chebyshev distance.

**Algorithm 6.1 (Border Intersection Detection).**
1. Compute $\mathcal{I} = S \cap \mathcal{B}_\tau$ (skeleton pixels in border band)
2. Filter for endpoints: $\mathcal{E} = \{p \in \mathcal{I} : \deg(p) = 1\}$
3. If $|\mathcal{E}| \geq 2$: return farthest pair
4. Else: return farthest pair from $\mathcal{I}$

### 6.3 Farthest Pair Computation

**Problem 6.1.** Given points $P = \{p_1, \ldots, p_n\} \subset \mathbb{R}^2$, find:

$$(p_i^*, p_j^*) = \arg\max_{i,j} \|p_i - p_j\|_2$$

**Solution via Distance Matrix:**

Construct $D \in \mathbb{R}^{n \times n}$ where $D_{ij} = \|p_i - p_j\|_2^2$:

$$D_{ij} = (x_i - x_j)^2 + (y_i - y_j)^2$$

Then $(i^*, j^*) = \arg\max_{i,j} D_{ij}$.

**Complexity:** $O(n^2)$ time, $O(n^2)$ space. For convex hull, reducible to $O(n \log n)$ via rotating calipers.

---

## 7. Graph Construction via BFS on 8-Connected Pixel Manifolds

### 7.1 Node Disk Regions

Each detected endpoint $v_i = (x_i, y_i)$ defines a *node disk* of radius $r$:

**Definition 7.1 (Node Disk).** 

$$\mathcal{D}_r(v_i) = \{(x, y) \in \Omega : (x - x_i)^2 + (y - y_i)^2 \leq r^2\}$$

**Definition 7.2 (Node ID Map).** The function $\phi: \Omega \to \{-1, 0, 1, \ldots, n-1\}$:

$$\phi(p) = \begin{cases}
i & \text{if } p \in \mathcal{D}_r(v_i) \text{ for unique } i \\
\arg\min_i \|p - v_i\|_2 & \text{if } p \in \bigcap_{j} \mathcal{D}_r(v_j) \text{ (overlap resolution)} \\
-1 & \text{if } p \notin \bigcup_i \mathcal{D}_r(v_i)
\end{cases}$$

### 7.2 Boundary Ports

**Definition 7.3 (Port).** A *port* for node $v_i$ is a skeleton pixel $p$ such that:
1. $p \notin \mathcal{D}_r(v_i)$ (outside the disk)
2. $\exists q \in \mathcal{N}_8(p)$ such that $q \in \mathcal{D}_r(v_i)$ (adjacent to disk)
3. $S(p) = 1$ (on skeleton)

Ports represent the entry/exit points of skeleton branches from a node region.

### 7.3 BFS Traversal Algorithm

**Algorithm 7.1 (Skeleton BFS for Adjacency).**

```
function BuildAdjacency(S, V, r):
    φ ← BuildNodeIDMap(S, V, r)
    A ← {i: ∅ for i in 0..n-1}
    
    for each node i in V:
        P ← FindPorts(i, S, φ, r)
        visited ← ∅
        queue ← P
        
        while queue ≠ ∅:
            p ← dequeue(queue)
            
            # Check 8-neighbors for other node disks
            for q in N₈(p):
                if φ(q) ≠ -1 and φ(q) ≠ i:
                    A[i] ← A[i] ∪ {φ(q)}
                    A[φ(q)] ← A[φ(q)] ∪ {i}
            
            # Expand BFS to skeleton neighbors
            for q in N₈(p):
                if S(q) = 1 and q ∉ visited and φ(q) = -1:
                    visited ← visited ∪ {q}
                    enqueue(queue, q)
    
    return A
```

### 7.4 Correctness Proof

**Theorem 7.1 (BFS Correctness).** Algorithm 7.1 correctly identifies all pairs of nodes $(v_i, v_j)$ that are connected by a skeleton path not passing through any other node disk.

*Proof.* 
1. **Completeness:** If nodes $v_i$ and $v_j$ are connected by a skeleton path $\gamma$ avoiding other disks, then BFS from $v_i$ will traverse $\gamma$ and detect $v_j$ when reaching its disk boundary.

2. **Soundness:** If $(v_i, v_j) \in A$, then BFS found a skeleton path from a port of $v_i$ to the boundary of $\mathcal{D}_r(v_j)$. Since BFS only traverses skeleton pixels with $\phi(p) = -1$, this path avoids all node interiors.

3. **Symmetry:** The algorithm explicitly adds both $(i,j)$ and $(j,i)$, ensuring undirected representation.

$\square$

### 7.5 8-Connectivity Requirement

**Theorem 7.2 (Skeleton Connectivity).** Morphological skeletonization produces 8-connected skeletons. Therefore, BFS must use 8-connectivity to traverse all skeleton paths.

*Proof.* The Zhang-Suen algorithm preserves 8-connectivity by construction. Diagonal moves are essential since the skeleton may have pixels connected only diagonally (e.g., a $45°$ line has pattern $\nearrow$). Using 4-connectivity would partition such skeletons into disconnected components. $\square$

---

## 8. Connected Component Analysis and Graph-Theoretic Properties

### 8.1 Component Enumeration

**Definition 8.1 (Connected Component).** In graph $G = (V, E)$, a connected component is a maximal subgraph $G' = (V', E')$ where every pair of vertices in $V'$ is connected by a path.

**Algorithm 8.1 (Component Counting via BFS).**

```
function CountComponents(A):
    visited ← ∅
    count ← 0
    
    for each node v in V:
        if v ∉ visited:
            count ← count + 1
            BFS_Mark(v, A, visited)
    
    return count
```

**Complexity:** $O(|V| + |E|)$

### 8.2 Graph Metrics

For the extracted graph $G = (V, E)$:

- **Order:** $|V| = n$ (number of nodes)
- **Size:** $|E| = m$ (number of edges)
- **Degree sequence:** $(d_1, d_2, \ldots, d_n)$ where $d_i = |A[i]|$
- **Average degree:** $\bar{d} = \frac{2m}{n}$

**Theorem 8.1 (Handshaking Lemma).** $\sum_{i=1}^{n} d_i = 2m$

### 8.3 Planarity

**Theorem 8.2.** The extracted skeleton graph is planar, as it is embedded in $\mathbb{R}^2$ without edge crossings (edges follow skeleton paths which do not intersect by construction).

**Corollary 8.1 (Euler's Formula).** For a connected planar graph: $|V| - |E| + |F| = 2$ where $|F|$ is the number of faces.

---

## 9. Computational Complexity Analysis

### 9.1 Pipeline Complexity Summary

| Algorithm | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Median Filter $(k \times k)$ | $O(WHk^2)$ | $O(WH)$ |
| Otsu Thresholding | $O(WH + L)$ | $O(L)$ |
| Skeletonization | $O(WH \cdot \text{iter})$ | $O(WH)$ |
| Dilation $(k \times k)$ | $O(WHk^2)$ | $O(WH)$ |
| Endpoint Detection | $O(n \cdot B)$ | $O(B)$ |
| BFS Adjacency | $O(n \cdot WH)$ | $O(WH)$ |

Where:
- $W, H$: image dimensions
- $L$: intensity levels (256)
- $n$: number of nodes
- $B$: average bounding box area
- $\text{iter}$: thinning iterations (typically $O(\min(W,H))$)

### 9.2 Overall Complexity

**Theorem 9.1.** The complete pipeline runs in $O(WH \cdot \min(W,H))$ time and $O(WH)$ space, dominated by the skeletonization step.

---

## 10. References

1. Otsu, N. (1979). "A Threshold Selection Method from Gray-Level Histograms." *IEEE Trans. Systems, Man, and Cybernetics*, 9(1), 62-66.

2. Zhang, T.Y., & Suen, C.Y. (1984). "A Fast Parallel Algorithm for Thinning Digital Patterns." *Communications of the ACM*, 27(3), 236-239.

3. Blum, H. (1967). "A Transformation for Extracting New Descriptors of Shape." *Models for Perception of Speech and Visual Form*, 362-380.

4. Serra, J. (1982). *Image Analysis and Mathematical Morphology*. Academic Press.

5. Gonzalez, R.C., & Woods, R.E. (2018). *Digital Image Processing* (4th ed.). Pearson.

6. Cormen, T.H., et al. (2009). *Introduction to Algorithms* (3rd ed.). MIT Press.

7. Soille, P. (2003). *Morphological Image Analysis: Principles and Applications*. Springer.

---

## Appendix A: Proofs of Key Theorems

### A.1 Proof of Otsu's Variance Decomposition (Theorem 3.1)

Let $X$ be a random variable representing pixel intensity with pmf $\{p_i\}$. Let $C \in \{0, 1\}$ be the class indicator for threshold $t$.

$$\text{Var}(X) = \mathbb{E}[\text{Var}(X|C)] + \text{Var}(\mathbb{E}[X|C])$$

The first term:
$$\mathbb{E}[\text{Var}(X|C)] = P(C=0)\text{Var}(X|C=0) + P(C=1)\text{Var}(X|C=1) = \omega_0\sigma_0^2 + \omega_1\sigma_1^2 = \sigma_W^2$$

The second term:
$$\text{Var}(\mathbb{E}[X|C]) = \omega_0(\mu_0 - \mu_T)^2 + \omega_1(\mu_1 - \mu_T)^2$$

Using $\mu_T = \omega_0\mu_0 + \omega_1\mu_1$:
$$= \omega_0\omega_1^2(\mu_0 - \mu_1)^2 + \omega_1\omega_0^2(\mu_1 - \mu_0)^2 = \omega_0\omega_1(\mu_0 - \mu_1)^2 = \sigma_B^2$$

$\square$

---

## Appendix B: Algorithm Pseudocode

### B.1 Complete Pipeline

```
Input: Grayscale image I, YOLO detections D
Output: Adjacency graph G = (V, E)

1. I' ← MedianFilter(I, k=5)
2. t* ← OtsuThreshold(I')
3. B ← (I' > t*)
4. S₁ ← Skeletonize(¬B)
5. S₂ ← EraseComponents(S₁, D)
6. S₃ ← Skeletonize(Dilate(S₂))
7. V ← DetectEndpoints(S₃, D)
8. E ← BFS_Adjacency(S₃, V, radius=20)
9. return (V, E)
```

---

*Document prepared for the LineDetect project. Mathematical rigor maintained throughout for academic and research applications.*
