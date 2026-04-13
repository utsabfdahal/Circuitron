"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  type AnalysisResult,
  type AnalysisComponent,
  type Junction,
  type GraphNode,
} from "@/services/analysis-api";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Eye,
  EyeOff,
  Layers,
  CircleDot,
  Cable,
} from "lucide-react";

/* ───────────────── colour palette ───────────────── */
const COMPONENT_COLORS: Record<string, string> = {
  resistor: "#e74c3c",
  capacitor: "#3498db",
  inductor: "#9b59b6",
  diode: "#e67e22",
  transistor: "#1abc9c",
  voltage: "#f1c40f",
  gnd: "#7f8c8d",
  vss: "#7f8c8d",
  switch: "#2ecc71",
  operational_amplifier: "#8e44ad",
  integrated_circuit: "#2c3e50",
  relay: "#16a085",
  fuse: "#d35400",
  motor: "#27ae60",
  lamp: "#f39c12",
  speaker: "#c0392b",
  probe: "#2980b9",
  crystal: "#8e44ad",
  transformer: "#6c3483",
  default: "#95a5a6",
};

function getComponentColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(COMPONENT_COLORS)) {
    if (key !== "default" && lower.includes(key)) return color;
  }
  return COMPONENT_COLORS.default;
}

/* ───────── map graph nodes → components/junctions ───────── */
function buildNodeOwnerMap(
  nodes: GraphNode[],
  components: AnalysisComponent[],
  junctions: Junction[],
  margin = 30
): Map<number, { kind: "component" | "junction"; id: string | number }> {
  const map = new Map<
    number,
    { kind: "component" | "junction"; id: string | number }
  >();
  for (const node of nodes) {
    let bestDist = Infinity;
    let bestMatch: (typeof map extends Map<number, infer V> ? V : never) | null =
      null;

    for (const comp of components) {
      const [x1, y1, x2, y2] = comp.bbox;
      if (
        node.x >= x1 - margin &&
        node.x <= x2 + margin &&
        node.y >= y1 - margin &&
        node.y <= y2 + margin
      ) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const dist = Math.hypot(node.x - cx, node.y - cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = { kind: "component", id: comp.id };
        }
      }
    }
    for (const junc of junctions) {
      const [x1, y1, x2, y2] = junc.bbox;
      if (
        node.x >= x1 - margin &&
        node.x <= x2 + margin &&
        node.y >= y1 - margin &&
        node.y <= y2 + margin
      ) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const dist = Math.hypot(node.x - cx, node.y - cy);
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = { kind: "junction", id: junc.id };
        }
      }
    }

    if (bestMatch) map.set(node.id, bestMatch);
  }
  return map;
}

/* ───────────── component SVG symbols ───────────── */

function ResistorSymbol({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  // Draw a zigzag inside the bbox
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hw = Math.min(w, h) * 0.4;
  const segments = 6;
  const dx = (w * 0.7) / segments;
  const startX = cx - (w * 0.35);
  const points: string[] = [`${startX},${cy}`];
  for (let i = 0; i < segments; i++) {
    const px = startX + dx * (i + 0.5);
    const py = cy + (i % 2 === 0 ? -hw : hw);
    points.push(`${px},${py}`);
  }
  points.push(`${cx + w * 0.35},${cy}`);
  return (
    <polyline
      points={points.join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

function CapacitorSymbol({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gap = Math.min(w, h) * 0.12;
  const plateH = Math.min(h, w) * 0.55;
  return (
    <g>
      <line x1={cx - gap} y1={cy - plateH / 2} x2={cx - gap} y2={cy + plateH / 2} stroke={color} strokeWidth={3} />
      <line x1={cx + gap} y1={cy - plateH / 2} x2={cx + gap} y2={cy + plateH / 2} stroke={color} strokeWidth={3} />
      <line x1={x + 4} y1={cy} x2={cx - gap} y2={cy} stroke={color} strokeWidth={2} />
      <line x1={cx + gap} y1={cy} x2={x + w - 4} y2={cy} stroke={color} strokeWidth={2} />
    </g>
  );
}

function DiodeSymbol({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const sz = Math.min(w, h) * 0.35;
  return (
    <g>
      <polygon
        points={`${cx - sz},${cy - sz} ${cx + sz},${cy} ${cx - sz},${cy + sz}`}
        fill={`${color}40`}
        stroke={color}
        strokeWidth={2}
      />
      <line x1={cx + sz} y1={cy - sz} x2={cx + sz} y2={cy + sz} stroke={color} strokeWidth={2.5} />
    </g>
  );
}

function GndSymbol({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const s = Math.min(w, h) * 0.3;
  return (
    <g>
      <line x1={cx} y1={cy - s} x2={cx} y2={cy} stroke={color} strokeWidth={2} />
      <line x1={cx - s} y1={cy} x2={cx + s} y2={cy} stroke={color} strokeWidth={2.5} />
      <line x1={cx - s * 0.65} y1={cy + s * 0.35} x2={cx + s * 0.65} y2={cy + s * 0.35} stroke={color} strokeWidth={2} />
      <line x1={cx - s * 0.3} y1={cy + s * 0.7} x2={cx + s * 0.3} y2={cy + s * 0.7} stroke={color} strokeWidth={1.5} />
    </g>
  );
}

function InductorSymbol({
  x,
  y,
  w,
  h,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const loops = 4;
  const loopW = (w * 0.7) / loops;
  const startX = cx - (w * 0.35);
  const r = loopW / 2;
  const arcs: string[] = [`M ${startX} ${cy}`];
  for (let i = 0; i < loops; i++) {
    const ax = startX + loopW * i + r;
    arcs.push(`A ${r} ${r} 0 1 1 ${ax + r} ${cy}`);
  }
  return (
    <path d={arcs.join(" ")} fill="none" stroke={color} strokeWidth={2} />
  );
}

/** Fallback: simple labelled rectangle */
function GenericSymbol({
  x,
  y,
  w,
  h,
  color,
  isHovered,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  isHovered: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={4}
      ry={4}
      fill={isHovered ? `${color}50` : `${color}18`}
      stroke={color}
      strokeWidth={isHovered ? 3 : 2}
    />
  );
}

function ComponentSymbol(
  props: { name: string; x: number; y: number; w: number; h: number; color: string; isHovered: boolean }
) {
  const { name, x, y, w, h, color, isHovered } = props;
  const lower = name.toLowerCase();
  // Always render the background rectangle
  const bg = (
    <GenericSymbol x={x} y={y} w={w} h={h} color={color} isHovered={isHovered} />
  );
  let symbol: React.ReactNode = null;
  if (lower.includes("resistor")) symbol = <ResistorSymbol x={x} y={y} w={w} h={h} color={color} />;
  else if (lower.includes("capacitor")) symbol = <CapacitorSymbol x={x} y={y} w={w} h={h} color={color} />;
  else if (lower.includes("diode")) symbol = <DiodeSymbol x={x} y={y} w={w} h={h} color={color} />;
  else if (lower.includes("gnd") || lower.includes("vss")) symbol = <GndSymbol x={x} y={y} w={w} h={h} color={color} />;
  else if (lower.includes("inductor")) symbol = <InductorSymbol x={x} y={y} w={w} h={h} color={color} />;
  return (
    <>
      {bg}
      {symbol}
    </>
  );
}

/* ═══════════════════  MAIN COMPONENT  ═══════════════════ */

interface Props {
  result: AnalysisResult;
  originalImageUrl: string | null;
}

export function DigitalCircuitView({ result, originalImageUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const [hoveredComp, setHoveredComp] = useState<string | null>(null);

  // Layer visibility
  const [showGrid, setShowGrid] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showWires, setShowWires] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const { width: imgW, height: imgH } = result.image_size;

  /* ── derived data ── */
  const nodeOwnerMap = useMemo(
    () =>
      buildNodeOwnerMap(
        result.graph.nodes ?? [],
        result.components,
        result.junctions
      ),
    [result]
  );

  const wires = useMemo(() => {
    const nodes = result.graph.nodes ?? [];
    const edges = result.graph.edges ?? [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return edges
      .map((e) => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return null;
        const srcOwner = nodeOwnerMap.get(e.source);
        const tgtOwner = nodeOwnerMap.get(e.target);
        const interComp =
          srcOwner &&
          tgtOwner &&
          (srcOwner.id !== tgtOwner.id || srcOwner.kind !== tgtOwner.kind);
        return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y, interComp };
      })
      .filter(Boolean) as {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      interComp: boolean;
    }[];
  }, [result, nodeOwnerMap]);

  /* ── interaction handlers ── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.1, Math.min(5, z + delta)));
  }, []);

  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - 40) / imgW;
    const scaleY = (rect.height - 40) / imgH;
    setZoom(Math.min(scaleX, scaleY, 2));
    setPan({ x: 20, y: 20 });
  }, [imgW, imgH]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  /* ── render ── */
  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/40 rounded-lg border border-border">
        {/* Zoom controls */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.min(z + 0.2, 5))}
        >
          <ZoomIn className="h-3.5 w-3.5 mr-1" /> In
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.max(z - 0.2, 0.1))}
        >
          <ZoomOut className="h-3.5 w-3.5 mr-1" /> Out
        </Button>
        <Button variant="outline" size="sm" onClick={fitToView}>
          <Maximize2 className="h-3.5 w-3.5 mr-1" /> Fit
        </Button>
        <Button variant="ghost" size="sm" onClick={resetView}>
          Reset
        </Button>

        <span className="w-px h-5 bg-border" />

        {/* Layer toggles */}
        <Button
          variant={showGrid ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowGrid((g) => !g)}
        >
          <Grid3X3 className="h-3.5 w-3.5 mr-1" /> Grid
        </Button>
        <Button
          variant={showWires ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowWires((w) => !w)}
        >
          <Cable className="h-3.5 w-3.5 mr-1" /> Wires
        </Button>
        <Button
          variant={showNodes ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowNodes((n) => !n)}
        >
          <CircleDot className="h-3.5 w-3.5 mr-1" /> Nodes
        </Button>
        <Button
          variant={showLabels ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowLabels((l) => !l)}
        >
          <Layers className="h-3.5 w-3.5 mr-1" /> Labels
        </Button>
        {originalImageUrl && (
          <Button
            variant={showOriginal ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowOriginal((o) => !o)}
          >
            {showOriginal ? (
              <EyeOff className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Eye className="h-3.5 w-3.5 mr-1" />
            )}
            Original
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {Math.round(zoom * 100)}% &mdash; drag to pan, scroll to zoom
        </span>
      </div>

      {/* ── SVG canvas ── */}
      <div
        ref={containerRef}
        className="relative border border-border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden select-none"
        style={{ height: 640, cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg width="100%" height="100%">
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Background */}
            <rect
              x={0}
              y={0}
              width={imgW}
              height={imgH}
              fill="white"
              stroke="#d1d5db"
              strokeWidth={1}
            />

            {/* Grid */}
            {showGrid && (
              <g opacity={0.12}>
                {Array.from(
                  { length: Math.ceil(imgW / 50) + 1 },
                  (_, i) => (
                    <line
                      key={`gv${i}`}
                      x1={i * 50}
                      y1={0}
                      x2={i * 50}
                      y2={imgH}
                      stroke="#94a3b8"
                      strokeWidth={0.5}
                    />
                  )
                )}
                {Array.from(
                  { length: Math.ceil(imgH / 50) + 1 },
                  (_, i) => (
                    <line
                      key={`gh${i}`}
                      x1={0}
                      y1={i * 50}
                      x2={imgW}
                      y2={i * 50}
                      stroke="#94a3b8"
                      strokeWidth={0.5}
                    />
                  )
                )}
              </g>
            )}

            {/* Original image underlay */}
            {showOriginal && originalImageUrl && (
              <image
                href={originalImageUrl}
                x={0}
                y={0}
                width={imgW}
                height={imgH}
                opacity={0.25}
              />
            )}

            {/* ── Wires (graph edges) ── */}
            {showWires && (
              <g>
                {wires.map((w, i) => (
                  <line
                    key={`w${i}`}
                    x1={w.x1}
                    y1={w.y1}
                    x2={w.x2}
                    y2={w.y2}
                    stroke={w.interComp ? "#2563eb" : "#64748b"}
                    strokeWidth={w.interComp ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            )}

            {/* ── Components ── */}
            <g>
              {result.components.map((comp) => {
                const [x1, y1, x2, y2] = comp.bbox;
                const w = x2 - x1;
                const h = y2 - y1;
                const color = getComponentColor(comp.name);
                const isHovered = hoveredComp === comp.id;

                return (
                  <g
                    key={comp.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredComp(comp.id)}
                    onMouseLeave={() => setHoveredComp(null)}
                  >
                    {/* Symbol */}
                    <ComponentSymbol
                      name={comp.name}
                      x={x1}
                      y={y1}
                      w={w}
                      h={h}
                      color={color}
                      isHovered={isHovered}
                    />

                    {/* Pin dots (nodes belonging to this component) */}
                    {showNodes &&
                      (result.graph.nodes ?? [])
                        .filter((n) => {
                          const owner = nodeOwnerMap.get(n.id);
                          return (
                            owner?.kind === "component" &&
                            owner.id === comp.id
                          );
                        })
                        .map((n) => (
                          <circle
                            key={`pin-${n.id}`}
                            cx={n.x}
                            cy={n.y}
                            r={4}
                            fill="#ef4444"
                            stroke="white"
                            strokeWidth={1.5}
                          />
                        ))}

                    {/* Label */}
                    {showLabels && (
                      <g>
                        <rect
                          x={x1}
                          y={y1 - 18}
                          width={
                            Math.max(
                              w,
                              (comp.id.length + comp.name.length + 3) * 6.5 +
                                12
                            )
                          }
                          height={17}
                          rx={3}
                          ry={3}
                          fill={color}
                          opacity={0.92}
                        />
                        <text
                          x={x1 + 5}
                          y={y1 - 4}
                          fill="white"
                          fontSize={11}
                          fontWeight="bold"
                          fontFamily="ui-monospace, monospace"
                        >
                          {comp.id} — {comp.name}
                          {comp.value ? ` (${comp.value})` : ""}
                        </text>
                      </g>
                    )}

                    {/* Hover tooltip */}
                    {isHovered && (
                      <g>
                        <rect
                          x={x1}
                          y={y2 + 6}
                          width={200}
                          height={54}
                          rx={5}
                          ry={5}
                          fill="rgba(15,23,42,0.92)"
                        />
                        <text
                          x={x1 + 8}
                          y={y2 + 22}
                          fill="white"
                          fontSize={11}
                          fontFamily="sans-serif"
                          fontWeight="600"
                        >
                          {comp.id}: {comp.name}
                        </text>
                        <text
                          x={x1 + 8}
                          y={y2 + 37}
                          fill="#cbd5e1"
                          fontSize={10}
                          fontFamily="sans-serif"
                        >
                          Conf: {(comp.confidence * 100).toFixed(1)}%
                          {comp.value ? ` | Value: ${comp.value}` : ""}
                        </text>
                        <text
                          x={x1 + 8}
                          y={y2 + 51}
                          fill="#94a3b8"
                          fontSize={9}
                          fontFamily="ui-monospace, monospace"
                        >
                          BBox: [{comp.bbox.join(", ")}]
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Junctions ── */}
            <g>
              {result.junctions.map((junc) => {
                const [cx, cy] = junc.position;
                return (
                  <g key={`j${junc.id}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth={2}
                    />
                    {showLabels && (
                      <text
                        x={cx}
                        y={cy + 18}
                        textAnchor="middle"
                        fill="#475569"
                        fontSize={9}
                        fontFamily="sans-serif"
                      >
                        {junc.type}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ── Unowned graph nodes ── */}
            {showNodes && (
              <g>
                {(result.graph.nodes ?? [])
                  .filter((n) => !nodeOwnerMap.has(n.id))
                  .map((n) => (
                    <circle
                      key={`un${n.id}`}
                      cx={n.x}
                      cy={n.y}
                      r={3.5}
                      fill="#f97316"
                      stroke="white"
                      strokeWidth={1}
                      opacity={0.7}
                    />
                  ))}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border">
        <span className="font-semibold mr-1">Legend:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" />
          Pin / endpoint
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#f97316] inline-block" />
          Free node
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#0f172a] inline-block" />
          Junction
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-8 h-[3px] bg-[#2563eb] inline-block rounded" />
          Wire (inter-component)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-8 h-[2px] bg-[#64748b] inline-block rounded" />
          Wire (intra / other)
        </span>
        {Object.entries(COMPONENT_COLORS)
          .filter(([k]) => k !== "default")
          .slice(0, 8)
          .map(([key, color]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <span
                className="w-3 h-3 rounded inline-block"
                style={{ backgroundColor: color }}
              />
              {key}
            </span>
          ))}
      </div>
    </div>
  );
}
