# CIRCUITRON — Presentation Script

> **Project Title:** CIRCUITRON: Circuit Recognition, Transformation, and Analysis  
> **Presented by:** Anveshan Timsina · Sandesh Dhital · Saroj Nagarkoti · Utsab Dahal  
> **Supervised by:** Er. Kobid Karkee  
> **Institution:** Tribhuvan University, Institute of Engineering, Thapathali Campus  
> **Department:** Electronics and Computer Engineering  
> **Date:** March 2026

---

## DELIVERY NOTES

- **[PAUSE]** — hold for 2 seconds to let the point sink in.  
- **[CLICK]** — advance the slide.  
- **[GESTURE]** — point to the screen / diagram.  
- Speaker names are marked in **bold** before each section so the team can split accordingly.  
- Maintain eye contact with the panel, not the screen.  
- Speak slowly on key statistics — let numbers land.

---

## 1. TEAM INTRODUCTION

**[Slide: Title slide with project name, university crest, team photo/names]**

**Speaker — Anveshan Timsina:**

> Respected supervisor Er. Kobid Karkee, respected project coordinator Er. Sudip Rana, respected Head of Department Er. Umesh Kanta Ghimire, respected external examiner, and distinguished members of the evaluation panel — Namaskar, and good morning.
>
> We are Group — from the Department of Electronics and Computer Engineering, Thapathali Campus, and today we are here to present our major project.
>
> **[CLICK]**
>
> Allow me to introduce our team.
>
> I am **Anveshan Timsina**, roll number THA078BEI005.
>
> With me are — **Sandesh Dhital**, THA078BEI034; **Saroj Nagarkoti**, THA078BEI039; and **Utsab Dahal**, THA078BEI046.
>
> Our project has been carried out under the invaluable supervision of **Er. Kobid Karkee**, and we are deeply grateful for his continuous guidance throughout this journey.
>
> **[PAUSE]**
>
> The project we present today is titled:
>
> **"CIRCUITRON: Circuit Recognition, Transformation, and Analysis."**

---

## 2. MOTIVATION

**[Slide: Motivation — show a hand-drawn circuit on one side, and a simulation on the other, with a visual "gap" between them]**

**Speaker — Sandesh Dhital:**

> Before we dive into the technical details, allow us to share *why* this project exists — because we believe the "why" matters more than the "what."
>
> **[PAUSE]**
>
> Every single one of us in this room has, at some point, sat in a classroom and sketched a circuit by hand. Resistors, capacitors, voltage sources — drawn on paper with pencil, labeled with values, and then... left there. Left on paper.
>
> **[PAUSE]**
>
> Now, there are excellent simulation tools out there — LTspice, KiCad, Multisim — tools that can bring those circuits to life. But here's the catch: *none of them can read what we draw.* Every single time, a student has to *redraw* the circuit inside the software — manually placing each component, wiring each node, entering each value. It's tedious. It's error-prone. And honestly? It's just dull enough that most students — and even some instructors — skip the simulation step entirely.
>
> **[PAUSE]**
>
> And that's the real tragedy. Because research has consistently shown — notably Chen et al., 2011 — that students perform *significantly better* when given visual, manipulative simulation tools, especially in the domain of electrical circuits. The *understanding* deepens. The *intuition* sharpens. But because there is no convenient bridge between a hand-drawn sketch and a simulation, this potential goes unrealized — particularly in countries like Nepal, where the technological ecosystem is still maturing.
>
> **[PAUSE]**
>
> This isn't just an academic exercise for us. As electronics engineering students ourselves — students who have sat through those same classes, drawn those same circuits, and felt that same friction — we are *uniquely positioned* to understand this problem. We haven't just studied it. We've *lived* it.
>
> **[CLICK]**
>
> And so CIRCUITRON was born — not from a textbook, but from a genuine desire to build the tool we *wished* we'd had.

---

## 3. INTRODUCTION

**[Slide: System overview — show the CIRCUITRON logo/banner, a one-line tagline, and the high-level input→output flow: Hand-drawn image → Digital Schematic + Simulation]**

**Speaker — Saroj Nagarkoti:**

> So, what exactly is CIRCUITRON?
>
> **[CLICK]**
>
> CIRCUITRON is an end-to-end integrated system that converts hand-drawn electrical circuit diagrams into CircuitJS-compatible text files — enabling simulation, graphical analysis, and interactive exploration of circuits in a fully digital, editable environment.
>
> **[GESTURE — point to the flow on screen]**
>
> In simple terms: you draw a circuit on paper, you take a photo, you upload it — and CIRCUITRON gives you back a *working, simulatable, editable* digital schematic. Not a static image. A *living* circuit.
>
> **[PAUSE]**
>
> But we didn't stop there. CIRCUITRON also integrates a prompt-based AI assistant — powered by DeepSeek v3.1 — that allows users to ask natural-language questions about their circuit. "What is the total resistance?" "What happens if I double this capacitor's value?" The system answers, in plain English, in real time.
>
> **[PAUSE]**
>
> The underlying technology is a multi-stage deep learning pipeline:
>
> - **YOLOv7** for real-time component detection — achieving a **95.62% mAP@0.5**.
> - **TrOCR and Custom CRNN** for handwritten text recognition — achieving **84.5% character accuracy**.
> - A **skeleton-based wire detection algorithm** using multi-head BFS for robust connectivity inference.
> - **CircuitJS** integration for browser-based simulation.
> - A **Next.js frontend** for an intuitive, responsive user experience.
>
> **[PAUSE]**
>
> In short — CIRCUITRON takes a messy, analog sketch and transforms it into precise, digital, *actionable* knowledge.

---

## 4. PROBLEM STATEMENT

**[Slide: Problem Statement — clean, bold text on screen. Consider a visual: a student redrawing a circuit in software with a frustrated expression, with a red "X" over the manual workflow]**

**Speaker — Utsab Dahal:**

> Let us now formally define the problem that CIRCUITRON addresses.
>
> **[CLICK]**
>
> The Electronic Design Automation tools available today — tools like LTspice, KiCad, Multisim — are powerful. But they share a critical blind spot: **none of them support the direct transformation of hand-drawn circuit images into simulation-ready schematics.**
>
> **[PAUSE]**
>
> A few nascent prototypes do exist in the academic literature. But to date, there is **no widely adopted, robust, or user-friendly pipeline** that combines:
>
> 1. Component recognition,  
> 2. Reliable wire connectivity inference,  
> 3. Schematic generation, and  
> 4. Simulation —
>
> ...into a single, seamless workflow — whether standalone or through integration with SPICE-based simulators.
>
> **[PAUSE]**
>
> This gap forces users into a tedious, manual transcription process that discourages the very simulation and analysis practices that would *most benefit* their learning.
>
> **[CLICK]**
>
> CIRCUITRON directly addresses this gap.
>
> Our project objectives are twofold:
>
> **Objective 1:** To *automatically* convert hand-drawn circuit diagrams into CircuitJS-compatible text files for simulation.
>
> **Objective 2:** To *visualize* the circuit in an editable schematic — complemented by an AI assistant for handling circuit-related queries.
>
> **[PAUSE]**
>
> These are not incremental improvements. This is a *fundamentally new workflow* — one that eliminates the manual bottleneck between sketch and simulation entirely.

---

## 5. SCOPE AND LIMITATIONS

**[Slide: Two-column layout. Left column: "Project Scope" with green checkmarks. Right column: "Limitations" with amber caution icons.]**

**Speaker — Anveshan Timsina:**

> With the objectives defined, let us clearly delineate what CIRCUITRON *does* — and what it does *not* attempt to do. Transparency here is as important as ambition.
>
> **[CLICK]**
>
> **Scope:**
>
> CIRCUITRON focuses on the development of a complete software pipeline that:
>
> - Accepts scanned or photographed images of hand-drawn electrical circuits,
> - Detects common circuit components and their annotated values in mentioned units,
> - Infers wire connectivity with junction recognition,
> - Transforms the detected information into CircuitJS-compatible netlists for simulation,
> - Generates editable schematics through an intermediate integrated data structure, and
> - Incorporates an LLM-based AI assistant for answering circuit-related queries.
>
> The system supports basic to moderately complex circuits composed of standard, commonly used components.
>
> **[PAUSE]**
>
> **[CLICK]**
>
> **Limitations:**
>
> We believe in honest engineering. And so, here is where CIRCUITRON has boundaries:
>
> - **Image quality dependency:** The system's accuracy is directly tied to the clarity of the input image. Low-resolution, heavily smudged, or extremely messy sketches may introduce recognition errors. Better training data will progressively chip away at this, but the perfect dataset remains elusive.
>
> - **Fixed component set:** CIRCUITRON currently supports a defined set of commonly used components — 15 classes in total. Rare, exotic, or user-defined symbols are not yet supported.
>
> - **Wire drawing assumptions:** The wire-tracing algorithm assumes reasonably standard drawing practices. Highly non-standard, overlapping, or excessively tangled wiring may confuse the parser.
>
> - **Simulation engine dependency:** CIRCUITRON does not include a proprietary simulation engine. It leverages CircuitJS — which, while powerful and open-source, inherently limits the simulation capabilities to what CircuitJS supports.
>
> - **Excluded domains:** Advanced circuit paradigms — RF circuits, mixed-signal designs, PCB layouts — are *explicitly* outside the current scope.
>
> **[PAUSE]**
>
> These are not oversights. These are *conscious engineering decisions* — trade-offs made to deliver a robust, functional system within the constraints of a major project timeline. And each one of these limitations is a signpost for future work.

---

## 6. APPLICATIONS

**[Slide: Three application cards with icons — a graduation cap for "Education," a lightbulb/prototype icon for "Prototyping," a mobile phone for "Mobile Analysis"]**

**Speaker — Sandesh Dhital:**

> So — who is CIRCUITRON *for*? And where does it create real value?
>
> **[CLICK]**
>
> **Application 1: Educational Utility**
>
> This is CIRCUITRON's primary mission. It is, at its core, an *educational tool* — designed for students and instructors who want to go beyond static diagrams. Upload a sketch, get a simulation, ask the AI a question. The entire learning loop — draw, simulate, analyze, understand — is compressed into minutes instead of the current workflow which can take considerably longer.
>
> Imagine a classroom where a student can sketch a circuit during a lecture, photograph it, and *immediately* see the voltage waveforms, the current flows, the behavior under different conditions. That is the future CIRCUITRON enables.
>
> **[PAUSE]**
>
> **Application 2: Lightweight Prototyping**
>
> For early-stage hardware design, CIRCUITRON enables rapid comparison of hand-drawn designs with simulation results. Before committing to a full schematic in professional EDA software, an engineer can sketch, scan, and get quick feedback — catching errors early, when they're cheapest to fix.
>
> **Application 3: Mobile Simulation Tool**
>
> Because CIRCUITRON is web-based, it is inherently accessible from any device with a browser and a camera. This makes it a powerful on-the-go analysis tool — for students reviewing circuits before exams, or potentially, for field engineers who need quick circuit verification without access to a full workstation.
>
> **[PAUSE]**
>
> In all three applications, the common thread is the same: **CIRCUITRON removes the barrier between the analog world of pen and paper and the digital world of simulation and analysis.**

---

## 7. METHODOLOGY — BLOCK DIAGRAM

**[Slide: Full block diagram of the CIRCUITRON system (block_diagram.png). This is a critical slide — keep it on screen for the entire explanation.]**

**Speaker — Saroj Nagarkoti:**

> Now, let us walk you through *how* CIRCUITRON works — the methodology behind the system.
>
> **[CLICK]**
>
> **[GESTURE — point to the block diagram]**
>
> What you see here is the complete system architecture of CIRCUITRON — a multi-stage pipeline where each stage feeds into the next, progressively transforming a raw photograph into a simulation-ready digital schematic.
>
> Let me walk you through each block.

**Speaker — Utsab Dahal:**

> **[GESTURE — point to the Preprocessing block]**
>
> **Stage 1: Preprocessing**
>
> Everything begins here. The raw circuit image undergoes preprocessing — thresholding, contrast and brightness enhancement, and noise reduction — to produce a clean, high-contrast image suitable for the downstream models. Critically, the dataset annotations are also converted from Pascal VOC format to YOLO-compatible format at this stage to ensure compatibility. One important note: geometric augmentations like rotation are intentionally *avoided* — because rotating a circuit changes its semantic meaning.

**Speaker — Anveshan Timsina:**

> **[GESTURE — point to the Component Detection block]**
>
> **Stage 2: Circuit Component Detection — YOLOv7**
>
> The preprocessed image is fed into our fine-tuned YOLOv7 model — a real-time object detection architecture built around the E-LAN backbone, PAN-based neck, and a decoupled detection head. The model identifies and localizes 15 classes of circuit components — resistors, capacitors, inductors, voltage sources, current sources, diodes, LEDs, and more — as well as text regions. Each detection comes with a bounding box, a class label, and a confidence score.
>
> **[PAUSE]**
>
> Our retrained YOLOv7 achieves a **mean Average Precision of 95.62% at IoU 0.5**, with a **precision of 97.47%** and **recall of 93.50%**. These are not just good numbers — these are numbers that translate to *reliable, production-grade detection* in real-world conditions.

**Speaker — Sandesh Dhital:**

> **[GESTURE — point to the OCR block]**
>
> **Stage 3: Recognition of Component Values — OCR**
>
> Detecting components is only half the story. To generate a functional netlist, we need the *values* — "10kΩ," "100µF," "5V." This is where our OCR pipeline takes over.
>
> The text regions flagged by YOLOv7 are cropped, resized, and normalized, then passed through our recognition engines. We offer two options:
>
> - A **Custom CRNN** model trained from scratch following the Deep Text Recognition Benchmark framework — fast, lightweight, optimized for our use case.
> - **TrOCR** — Microsoft's transformer-based OCR model, minimally fine-tuned — slower, but more robust on difficult handwriting.
>
> The user gets to choose based on their priority: speed or accuracy. Our TrOCR achieves **84.5% character accuracy**, a **Character Error Rate of 0.12**, and a **Word Error Rate of 0.18**.

**Speaker — Saroj Nagarkoti:**

> **[GESTURE — point to the Wire Detection block]**
>
> **Stage 4: Wire Detection and Connectivity**
>
> This is arguably the most algorithmically challenging stage. After masking out all detected components, we apply Otsu's thresholding and morphological skeletonization to reduce wires to single-pixel-width paths. We then identify junction points, endpoints, and crossovers.
>
> The core algorithm uses **Multi-head BFS** — a breadth-first search initiated simultaneously from multiple component terminals — to trace wire paths and build an adjacency graph of connectivity. This approach handles horizontal, vertical, *and diagonal* wires, as well as wire crossings and T-junctions.
>
> The result is a complete **connectivity graph** — a machine-readable representation of which component connects to which, through which nodes.

**Speaker — Utsab Dahal:**

> **[GESTURE — point to the Proximity Mapping block]**
>
> **Stage 5: Proximity Mapping**
>
> With components detected and text recognized, we now need to answer: *which value belongs to which component?* This is handled by our proximity mapping algorithm, which uses spatial distance metrics between text bounding boxes and component bounding boxes to assign each recognized value to its nearest component — matching "10kΩ" to the resistor it was written next to.

**Speaker — Anveshan Timsina:**

> **[GESTURE — point to the Netlist Generation and Simulation blocks]**
>
> **Stage 6: Netlist Generation, Simulation, and Frontend**
>
> All this extracted information — component types, values, positions, and connectivity — is consolidated into an intermediate data structure and then serialized into a **CircuitJS-compatible text file**. This file can be directly loaded into CircuitJS for simulation — generating voltage/current waveforms, frequency responses, and transient analyses.
>
> Simultaneously, the data drives our **Next.js frontend**, which renders an editable schematic using KiCad symbol assets. Users can drag, resize, edit, and correct components. The **DeepSeek v3.1 AI assistant** is embedded directly into the interface, ready to answer questions about the circuit in natural language.
>
> **[PAUSE]**
>
> From a photograph of a hand-drawn sketch to a simulated, editable, AI-augmented digital circuit — that is the CIRCUITRON pipeline. End to end. Fully automated. Fully integrated.

---

## CLOSING TRANSITION

**Speaker — Anveshan Timsina:**

> **[PAUSE — let the block diagram sink in]**
>
> To summarize what we've covered so far:
>
> We identified a real, lived problem — the disconnect between hand-drawn circuits and digital simulation tools. We built CIRCUITRON to solve it — a deep learning pipeline that takes a photograph and produces a working, simulatable, editable schematic with an AI assistant built in.
>
> **[PAUSE]**
>
> In the following sections, we will walk you through the implementation details, the results and performance analysis, and our vision for future enhancements.
>
> Thank you for your attention so far. We now move to...
>
> **[CLICK — next section]**

---

## QUICK REFERENCE — KEY STATISTICS FOR Q&A

| Metric | Value |
|---|---|
| YOLOv7 mAP@0.5 | 95.62% |
| YOLOv7 Precision | 97.47% |
| YOLOv7 Recall | 93.50% |
| TrOCR Character Accuracy | 84.5% |
| TrOCR CER | 0.12 |
| TrOCR WER | 0.18 |
| Component Classes | 15 |
| Frontend Framework | Next.js 14 + React 18 |
| Backend Framework | FastAPI + Uvicorn |
| AI Assistant | DeepSeek v3.1 via Lightning AI |
| Simulation Engine | CircuitJS (GWT) |
| Total Budget | NPR 41,160 |

---

*Script prepared for the CIRCUITRON Major Project Final Defense — March 2026*
