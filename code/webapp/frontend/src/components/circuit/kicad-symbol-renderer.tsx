/**
 * Renders KiCad symbols as SVG elements.
 *
 * Converts parsed KicadSymbol data into SVG path/rect/circle/line elements
 * that can be embedded inside an <svg> or a React component.
 */

import React, { useMemo } from "react";
import {
  KicadSymbol,
  KicadPrimitive,
  KicadPin,
  KicadArc,
  parseKicadSymbol,
  pinBodyEnd,
} from "@/utils/kicad-parser";
import { KICAD_SYMBOL_SOURCES } from "@/utils/kicad-symbol-data";
import { ComponentType } from "@/types/circuit";

// ── Parsed symbol cache ─────────────────────────────────────────────────────

const symbolCache: Record<string, KicadSymbol> = {};

export function getKicadSymbol(type: string): KicadSymbol | null {
  if (symbolCache[type]) return symbolCache[type];
  const src = KICAD_SYMBOL_SOURCES[type];
  if (!src) return null;
  try {
    const parsed = parseKicadSymbol(src);
    symbolCache[type] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

// ── SVG arc helper ──────────────────────────────────────────────────────────

/**
 * Convert a 3-point arc (start, mid, end) into an SVG arc path.
 * We compute the circle through 3 points, then determine sweep/large-arc flags.
 */
function arcToSvgPath(arc: KicadArc, sy: number): string {
  const { start, mid, end } = arc;
  // sy = -1 to flip Y for SVG coordinate system
  const sx = start.x,
    sY = start.y * sy;
  const mx = mid.x,
    mY = mid.y * sy;
  const ex = end.x,
    eY = end.y * sy;

  // Find circumscribed circle through 3 points
  const ax = sx,
    ay = sY;
  const bx = mx,
    by = mY;
  const cx = ex,
    cy = eY;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) {
    // Degenerate: points are collinear, draw a line
    return `M ${sx} ${sY} L ${ex} ${eY}`;
  }

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    D;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    D;
  const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);

  // Determine sweep direction using cross product with midpoint
  const angleStart = Math.atan2(ay - uy, ax - ux);
  const angleMid = Math.atan2(by - uy, bx - ux);
  const angleEnd = Math.atan2(cy - uy, cx - ux);

  // Normalize angles to [0, 2π)
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const nStart = norm(angleStart);
  const nMid = norm(angleMid);
  const nEnd = norm(angleEnd);

  // Check if mid is on the sweep from start to end (counterclockwise)
  const ccwContains = (s: number, e: number, m: number) => {
    if (s <= e) return m >= s && m <= e;
    return m >= s || m <= e;
  };

  const sweepCCW = ccwContains(nStart, nEnd, nMid);
  const sweepFlag = sweepCCW ? 0 : 1;

  // Large arc: arc spans > 180 degrees
  let arcAngle = sweepCCW ? nEnd - nStart : nStart - nEnd;
  if (arcAngle < 0) arcAngle += 2 * Math.PI;
  const largeArc = arcAngle > Math.PI ? 1 : 0;

  return `M ${sx} ${sY} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ex} ${eY}`;
}

// ── Primitive to SVG element ────────────────────────────────────────────────

function renderPrimitive(
  prim: KicadPrimitive,
  index: number,
  scale: number,
  flipY: number,
  color: string
): React.ReactElement | null {
  const sw = Math.max(prim.strokeWidth * scale, 0.5);

  switch (prim.type) {
    case "polyline": {
      if (prim.points.length < 2) return null;
      const d =
        prim.points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * scale} ${p.y * flipY * scale}`)
          .join(" ") + (prim.points.length > 2 && prim.points[0].x === prim.points[prim.points.length - 1].x && prim.points[0].y === prim.points[prim.points.length - 1].y ? " Z" : "");
      return (
        <path
          key={`pl-${index}`}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    case "rectangle": {
      const x = Math.min(prim.start.x, prim.end.x) * scale;
      const y = Math.min(prim.start.y * flipY, prim.end.y * flipY) * scale;
      const w = Math.abs(prim.end.x - prim.start.x) * scale;
      const h = Math.abs(prim.end.y - prim.start.y) * scale;
      return (
        <rect
          key={`rt-${index}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={prim.fill === "outline" ? color : "none"}
          stroke={color}
          strokeWidth={sw}
        />
      );
    }
    case "arc": {
      const d = arcToSvgPath(prim, flipY);
      // Scale the path
      const scaledD = d.replace(/-?[\d.]+/g, (match) => {
        const n = parseFloat(match);
        return (n * scale).toString();
      });
      return (
        <path
          key={`ar-${index}`}
          d={scaledD}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      );
    }
    case "circle": {
      return (
        <circle
          key={`ci-${index}`}
          cx={prim.center.x * scale}
          cy={prim.center.y * flipY * scale}
          r={prim.radius * scale}
          fill={prim.fill === "outline" ? color : "none"}
          stroke={color}
          strokeWidth={sw}
        />
      );
    }
  }
}

function renderPin(
  pin: KicadPin,
  index: number,
  scale: number,
  flipY: number,
  color: string
): React.ReactElement {
  // Draw lead line from pin position (connection point) to body end
  const body = pinBodyEnd(pin);
  return (
    <line
      key={`pin-${index}`}
      x1={pin.position.x * scale}
      y1={pin.position.y * flipY * scale}
      x2={body.x * scale}
      y2={body.y * flipY * scale}
      stroke={color}
      strokeWidth={Math.max(0.5, 0.15 * scale)}
      strokeLinecap="round"
    />
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface KicadSymbolRendererProps {
  type: ComponentType;
  size?: number;
  color?: string;
}

/**
 * Renders a KiCad symbol as an inline SVG.
 * Falls back to nothing if the symbol isn't available.
 */
export const KicadSymbolRenderer: React.FC<KicadSymbolRendererProps> = ({
  type,
  size = 48,
  color = "currentColor",
}) => {
  const symbol = useMemo(() => getKicadSymbol(type), [type]);

  if (!symbol) return null;

  const { bounds, primitives, pins } = symbol;
  // Flip Y: KiCad Y-up → SVG Y-down
  const flipY = -1;

  // Calculate viewBox from bounding box with padding
  const pad = 0.5;
  const vbMinX = bounds.minX - pad;
  const vbMaxX = bounds.maxX + pad;
  // Flip Y bounds
  const vbMinY = -(bounds.maxY + pad);
  const vbMaxY = -(bounds.minY - pad);
  const vbW = vbMaxX - vbMinX;
  const vbH = vbMaxY - vbMinY;

  // Scale factor: we work at 1:1 in KiCad coords within the viewBox
  const scale = 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${vbMinX} ${vbMinY} ${vbW} ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      {primitives.map((p, i) => renderPrimitive(p, i, scale, flipY, color))}
      {pins.map((p, i) => renderPin(p, i, scale, flipY, color))}
    </svg>
  );
};

/**
 * Render a KiCad symbol as bare SVG children (no wrapping <svg>).
 * Meant to be placed inside a <g> that already provides
 *   translate(componentX, componentY) rotate(rotation)
 * The returned group applies scale(kicadScale, -kicadScale) to convert
 * KiCad mm → canvas pixels (with Y-flip for SVG).
 */
export function renderKicadSymbolInline(
  type: string,
  kicadScale: number,
  color: string,
): React.ReactNode | null {
  const sym = getKicadSymbol(type);
  if (!sym) return null;

  // Use uniform positive scale in the group transform and handle
  // the KiCad Y-up → SVG Y-down flip explicitly via flipY=-1.
  // This keeps arc sweep directions correct (a negative group scale
  // would silently reverse them).
  return (
    <g key="kicad-sym" transform={`scale(${kicadScale}, ${kicadScale})`}>
      {sym.primitives.map((p, i) => renderPrimitive(p, i, 1, -1, color))}
      {sym.pins.map((p, i) => renderPin(p, i, 1, -1, color))}
    </g>
  );
}

/**
 * Check if a given component type has a KiCad symbol available.
 */
export function hasKicadSymbol(type: string): boolean {
  return type in KICAD_SYMBOL_SOURCES;
}

/**
 * Get the pin positions for a given component type (in KiCad coordinates).
 * These are the connection points (where wires attach).
 */
export function getKicadPinPositions(
  type: string
): { x: number; y: number; number: string }[] | null {
  const sym = getKicadSymbol(type);
  if (!sym) return null;
  return sym.pins.map((pin) => ({
    x: pin.position.x,
    y: pin.position.y,
    number: pin.number,
  }));
}
