/**
 * Convert analysis pipeline output into the circuit editor's data model.
 *
 * Maps YOLO detections → CircuitComponent[], graph edges → Wire[],
 * and OCR text → TextElement[] so they can be loaded straight into
 * the main canvas as editable, draggable objects.
 */

import {
  type AnalysisResult,
  type AnalysisComponent as APIComponent,
} from "@/services/analysis-api";
import {
  type Circuit,
  type CircuitComponent,
  type Wire,
  type TextElement,
  type ComponentType,
  type ComponentTerminal,
} from "@/types/circuit";
import { COMPONENT_DEFINITIONS, GRID_SIZE, KICAD_SCALE } from "@/constants/components";
import { generateId, snapToGrid } from "@/utils";
import type { AnalysisConnection } from "@/context/circuit-context";
import { getKicadPinPositions } from "@/components/circuit/kicad-symbol-renderer";

/* ────────────────────────────────────────────────────────── */
/*  Parse a value string like "10k", "4.7uF", "20n" → number  */
/* ────────────────────────────────────────────────────────── */

const SI_MULTIPLIER: Record<string, number> = {
  p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3,
  k: 1e3, K: 1e3, M: 1e6, G: 1e9,
};

/**
 * Parse a human component value string (e.g. "10k", "4.7uF", "20nH") to a
 * raw number.  Returns null if parsing fails.
 */
function parseComponentValue(raw: string): number | null {
  const m = raw.trim().match(/^([\d.]+)\s*([pnuµmkKMG])?\s*[A-Za-zΩ]*$/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (isNaN(num)) return null;
  const mul = m[2] ? (SI_MULTIPLIER[m[2]] ?? 1) : 1;
  return num * mul;
}

/* ────────────────────────────────────────────────────────── */
/*  YOLO name → editor ComponentType mapping                  */
/* ────────────────────────────────────────────────────────── */

const YOLO_TO_EDITOR_TYPE: Record<string, ComponentType> = {
  // Passive
  resistor: "resistor",
  "resistor.adjustable": "resistor",
  "resistor.photo": "resistor",
  "capacitor.unpolarized": "capacitor",
  "capacitor.polarized": "capacitor",
  "capacitor.adjustable": "capacitor",
  inductor: "inductor",
  "inductor.ferrite": "inductor",
  "inductor.coupled": "inductor",
  transformer: "inductor",

  // Active
  diode: "diode",
  "diode.light_emitting": "led",
  "diode.thyrector": "diode",
  "diode.zener": "diode",
  switch: "switch",
  relay: "switch",

  // Sources
  "voltage.dc": "battery",
  "voltage.ac": "battery",
  "voltage.battery": "battery",
  gnd: "ground",
  vss: "ground",

  // Logic
  and: "and_gate",
  or: "or_gate",
  not: "not_gate",
  nand: "nand_gate",
  nor: "nor_gate",
  xor: "xor_gate",

  // Meters
  "probe.voltage": "voltmeter",
  "probe.current": "ammeter",
  probe: "voltmeter",

  // Transistors
  "transistor.bjt": "npn_transistor",
  "transistor.fet": "nmos_transistor",
  "transistor.photo": "npn_transistor",
};

/**
 * Best-effort map from a YOLO class name to an editor ComponentType.
 * Falls back to "resistor" for unknown types so nothing is lost.
 */
function mapYoloName(name: string): ComponentType {
  if (YOLO_TO_EDITOR_TYPE[name]) return YOLO_TO_EDITOR_TYPE[name];
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(YOLO_TO_EDITOR_TYPE)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return "resistor"; // safe default
}

/* ────────────────────────────────────────────────────────── */
/*  Build terminals for a component based on its graph nodes  */
/* ────────────────────────────────────────────────────────── */

function buildTerminals(
  compBbox: [number, number, number, number],
  compCenter: { x: number; y: number },
  nodePositions: { x: number; y: number }[],
  def: (typeof COMPONENT_DEFINITIONS)[ComponentType],
  editorType: ComponentType,
  symbolScale: number
): ComponentTerminal[] {
  // Try to use scaled KiCad pin positions so terminals align with the rendered symbol
  const kicadPins = getKicadPinPositions(editorType);
  if (kicadPins && kicadPins.length === def.terminals.length) {
    return kicadPins.map((pin, i) => ({
      id: generateId(),
      position: {
        // KiCad pin positions in mm → canvas px, scaled by symbolScale, Y-flipped
        x: Math.round(pin.x * KICAD_SCALE * symbolScale),
        y: Math.round(-pin.y * KICAD_SCALE * symbolScale),
      },
      type: def.terminals[i].type,
    }));
  }

  // Fallback: use detected node positions relative to center
  if (nodePositions.length > 0) {
    return nodePositions.map((np, i) => ({
      id: generateId(),
      position: {
        x: Math.round(np.x - compCenter.x),
        y: Math.round(np.y - compCenter.y),
      },
      type:
        i < def.terminals.length
          ? def.terminals[i].type
          : ("bidirectional" as const),
    }));
  }

  // Last resort: spread along X
  return def.terminals.map((t, i) => ({
    id: generateId(),
    position: { x: i * 50 - 25, y: 0 },
    type: t.type,
  }));
}

/* ────────────────────────────────────────────────────────── */
/*  Determine component orientation based on line alignment   */
/* ────────────────────────────────────────────────────────── */

/**
 * Determines component rotation based on the positions of
 * the graph nodes (wire endpoints) attached to it.
 *
 * If the two connection points align more vertically → 90°
 * If they align more horizontally → 0° (default)
 */
function detectOrientation(
  nodePositions: { x: number; y: number }[]
): number {
  if (nodePositions.length < 2) return 0;

  // Use first and last node positions
  const first = nodePositions[0];
  const last = nodePositions[nodePositions.length - 1];

  const dx = Math.abs(last.x - first.x);
  const dy = Math.abs(last.y - first.y);

  // If vertical span is larger than horizontal span → component should be vertical (90°)
  if (dy > dx * 1.2) return 90;

  return 0; // horizontal by default
}

/* ────────────────────────────────────────────────────────── */
/*  Deduplicate OCR text: remove text regions whose text     */
/*  matches component values already displayed as labels      */
/* ────────────────────────────────────────────────────────── */

function isTextNearComponent(
  textBbox: [number, number, number, number],
  compBbox: [number, number, number, number],
  margin: number
): boolean {
  const [tx1, ty1, tx2, ty2] = textBbox;
  const [cx1, cy1, cx2, cy2] = compBbox;
  const tcx = (tx1 + tx2) / 2;
  const tcy = (ty1 + ty2) / 2;
  return (
    tcx >= cx1 - margin &&
    tcx <= cx2 + margin &&
    tcy >= cy1 - margin &&
    tcy <= cy2 + margin
  );
}

/* ────────────────────────────────────────────────────────── */
/*  PUBLIC: convert an AnalysisResult → Circuit               */
/* ────────────────────────────────────────────────────────── */

export interface ConvertOptions {
  /** Scale factor applied to all coordinates (default 1) */
  scale?: number;
  /** Snap component positions to grid (default true) */
  snap?: boolean;
  /** Include OCR text as TextElements (default true) */
  includeOcrText?: boolean;
  /** Include component value text from OCR mapping (default true) */
  includeComponentValues?: boolean;
}

export interface ConvertResult {
  circuit: Circuit;
  /** All graph-edge line segments in scaled canvas coordinates */
  connections: AnalysisConnection[];
}

export function analysisToCircuit(
  analysis: AnalysisResult,
  opts: ConvertOptions = {}
): ConvertResult {
  const {
    scale = 1,
    snap = true,
    includeOcrText = true,
    includeComponentValues = true,
  } = opts;

  const s = (v: number) => {
    const scaled = v * scale;
    return snap ? snapToGrid(scaled, GRID_SIZE) : Math.round(scaled);
  };

  const graphNodes = analysis.graph.nodes ?? [];
  const graphEdges = analysis.graph.edges ?? [];
  const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));

  /* ── 1. Build a map: which graph-nodes belong to which component ── */

  const MARGIN = 30 * (1 / scale || 1);
  const nodeToComp = new Map<number, string>(); // graph-node-id → comp.id
  const compNodeIds = new Map<string, number[]>(); // comp.id → [graph-node-ids]

  for (const comp of analysis.components) {
    const [x1, y1, x2, y2] = comp.bbox;
    const ids: number[] = [];
    for (const gn of graphNodes) {
      if (
        gn.x >= x1 - MARGIN &&
        gn.x <= x2 + MARGIN &&
        gn.y >= y1 - MARGIN &&
        gn.y <= y2 + MARGIN
      ) {
        if (!nodeToComp.has(gn.id)) {
          nodeToComp.set(gn.id, comp.id);
          ids.push(gn.id);
        }
      }
    }
    compNodeIds.set(comp.id, ids);
  }

  /* ── 2. Convert components ── */

  // Map from API comp id → generated editor comp id (for wire linking)
  const apiIdToEditorId = new Map<string, string>();
  // Map from graph-node-id → terminal id (for wire creation)
  const nodeToTerminalId = new Map<number, { compId: string; termId: string }>();

  const components: CircuitComponent[] = analysis.components.map((ac) => {
    const editorType = mapYoloName(ac.name);
    const def = COMPONENT_DEFINITIONS[editorType];
    const compId = generateId();
    apiIdToEditorId.set(ac.id, compId);

    const cx = s(ac.position[0]);
    const cy = s(ac.position[1]);

    // Get positions of graph nodes that belong to this component
    const gnIds = compNodeIds.get(ac.id) ?? [];
    const gnPositions = gnIds
      .map((id) => nodeMap.get(id))
      .filter(Boolean)
      .map((n) => ({ x: s(n!.x), y: s(n!.y) }));

    // ── Compute symbol scale ──
    // Compare actual distance between detected skeleton points to the
    // KiCad symbol's default pin span so the symbol stretches/shrinks
    // to fit the detected endpoints exactly.
    let symbolScale = 1;
    const rotation = detectOrientation(gnPositions);

    if (gnPositions.length >= 2) {
      const first = gnPositions[0];
      const last = gnPositions[gnPositions.length - 1];
      const actualDist = Math.sqrt(
        (last.x - first.x) ** 2 + (last.y - first.y) ** 2
      );

      if (actualDist > 5) {
        // Get default KiCad pin span (in canvas px at scale=1)
        const kicadPins = getKicadPinPositions(editorType);
        if (kicadPins && kicadPins.length >= 2) {
          const p0 = kicadPins[0];
          const pN = kicadPins[kicadPins.length - 1];
          const defaultDist = Math.sqrt(
            (pN.x - p0.x) ** 2 + (pN.y - p0.y) ** 2
          ) * KICAD_SCALE; // convert from KiCad mm to canvas px
          if (defaultDist > 0) {
            symbolScale = Math.max(0.3, Math.min(3, actualDist / defaultDist));
          }
        } else {
          // Fallback: use definition terminal defaults (80px apart)
          const defaultSpan = 80;
          symbolScale = Math.max(0.3, Math.min(3, actualDist / defaultSpan));
        }
      }
    }

    // ── Position the component center at the midpoint of detected nodes ──
    let compX = cx;
    let compY = cy;
    if (gnPositions.length >= 2) {
      const first = gnPositions[0];
      const last = gnPositions[gnPositions.length - 1];
      compX = Math.round((first.x + last.x) / 2);
      compY = Math.round((first.y + last.y) / 2);
    }

    const terminals = buildTerminals(
      ac.bbox.map((v) => s(v)) as [number, number, number, number],
      { x: compX, y: compY },
      gnPositions,
      def,
      editorType,
      symbolScale
    );

    // Register terminal mapping for wire creation
    gnIds.forEach((gnId, i) => {
      if (i < terminals.length) {
        nodeToTerminalId.set(gnId, { compId, termId: terminals[i].id });
      }
    });

    // Build properties – include OCR value if available
    const props: Record<string, string | number | boolean> = {
      ...def.defaultProperties,
    };
    if (includeComponentValues && ac.value) {
      props["detectedValue"] = ac.value;
      // Try to parse the OCR text into the primary property
      const PRIMARY_KEY: Record<string, string> = {
        resistor: "resistance", capacitor: "capacitance",
        inductor: "inductance", battery: "voltage",
        led: "forwardVoltage", diode: "forwardVoltage",
        voltmeter: "resistance", ammeter: "resistance",
      };
      const pk = PRIMARY_KEY[editorType];
      if (pk) {
        const parsed = parseComponentValue(ac.value);
        if (parsed !== null) props[pk] = parsed;
      }
    }
    props["yoloConfidence"] = Math.round(ac.confidence * 100);
    props["originalName"] = ac.name;

    return {
      id: compId,
      type: editorType,
      position: { x: compX, y: compY, rotation },
      properties: props,
      terminals,
      label: def.name,
      symbolScale,
    };
  });

  /* ── 3. Convert graph edges → editable wires ── */
  /* Every graph edge becomes a proper Wire so the user can select,     */
  /* move, and delete any line.  Edges between two component terminals  */
  /* get from/to references; other edges become free-standing wires.    */

  const wires: Wire[] = [];
  for (const edge of graphEdges) {
    const fromT = nodeToTerminalId.get(edge.source);
    const toT = nodeToTerminalId.get(edge.target);

    // Skip intra-component edges
    if (fromT && toT && fromT.compId === toT.compId) continue;

    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    const points: { x: number; y: number }[] = [];
    if (srcNode) points.push({ x: s(srcNode.x), y: s(srcNode.y) });
    if (tgtNode) points.push({ x: s(tgtNode.x), y: s(tgtNode.y) });
    if (points.length < 2) continue;

    wires.push({
      id: generateId(),
      from: fromT
        ? { componentId: fromT.compId, terminalId: fromT.termId }
        : undefined,
      to: toT
        ? { componentId: toT.compId, terminalId: toT.termId }
        : undefined,
      points,
    });
  }

  /* ── 4. OCR text → TextElement[] (deduplicated) ── */

  const textElements: TextElement[] = [];

  // Collect component values for deduplication
  const componentValueTexts = new Set<string>();
  for (const ac of analysis.components) {
    if (ac.value) {
      componentValueTexts.add(ac.value.trim().toLowerCase());
    }
  }

  if (includeOcrText) {
    // OCR text regions → text elements
    // Skip text regions whose text matches a component value already shown as a label
    const DEDUP_MARGIN = 80;
    for (const tr of analysis.text_regions) {
      if (!tr.ocr_text) continue;

      const ocrLower = tr.ocr_text.trim().toLowerCase();

      // Check if this OCR text duplicates a component value nearby
      let isDuplicate = false;
      if (componentValueTexts.has(ocrLower)) {
        for (const ac of analysis.components) {
          if (!ac.value) continue;
          if (ac.value.trim().toLowerCase() === ocrLower) {
            if (isTextNearComponent(tr.bbox, ac.bbox, DEDUP_MARGIN)) {
              isDuplicate = true;
              break;
            }
          }
        }
      }
      if (isDuplicate) continue;

      const [x1, y1, x2, y2] = tr.bbox;
      const tx = s((x1 + x2) / 2);
      const ty = s((y1 + y2) / 2);
      textElements.push({
        id: generateId(),
        position: { x: tx, y: ty },
        text: tr.ocr_text,
        fontSize: 14,
        color: "#2563eb",
        fontWeight: "bold",
        fontFamily: "monospace",
      });
    }
  }

  /* ── 5. Junction markers → TextElement (small dot label) ── */

  for (const junc of analysis.junctions) {
    const [jx, jy] = junc.position;
    textElements.push({
      id: generateId(),
      position: { x: s(jx), y: s(jy) - 12 },
      text: `● ${junc.type}`,
      fontSize: 9,
      color: "#64748b",
    });
  }

  /* ── 6. Build connection lines from ALL graph edges (reference only) ── */
  /* All edges are now proper editable wires, so we keep the overlay    */
  /* connections as a lightweight visual reference that can be toggled.  */

  const connections: AnalysisConnection[] = [];
  for (const edge of graphEdges) {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (srcNode && tgtNode) {
      connections.push({
        x1: s(srcNode.x),
        y1: s(srcNode.y),
        x2: s(tgtNode.x),
        y2: s(tgtNode.y),
      });
    }
  }

  /* ── 7. Assemble Circuit ── */

  return {
    circuit: {
      id: generateId(),
      name: "Analyzed Circuit",
      components,
      wires,
      textElements,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: "1.0.0",
      },
    },
    connections,
  };
}
