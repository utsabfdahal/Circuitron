/**
 * KiCad .kicad_sym S-expression parser.
 *
 * Parses the text of a .kicad_sym file and extracts the draw primitives
 * (polyline, rectangle, arc, circle) and pin definitions, returning them
 * as a structured JSON object that the renderer can consume.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface KicadPoint {
  x: number;
  y: number;
}

export interface KicadPolyline {
  type: "polyline";
  points: KicadPoint[];
  strokeWidth: number;
}

export interface KicadRectangle {
  type: "rectangle";
  start: KicadPoint;
  end: KicadPoint;
  strokeWidth: number;
  fill: string; // "none" | "background" | "outline"
}

export interface KicadArc {
  type: "arc";
  start: KicadPoint;
  mid: KicadPoint;
  end: KicadPoint;
  strokeWidth: number;
}

export interface KicadCircle {
  type: "circle";
  center: KicadPoint;
  radius: number;
  strokeWidth: number;
  fill: string;
}

export interface KicadPin {
  number: string;
  name: string;
  position: KicadPoint;
  angle: number; // degrees
  length: number;
  type: string; // passive, input, output, power_in, etc.
}

export type KicadPrimitive =
  | KicadPolyline
  | KicadRectangle
  | KicadArc
  | KicadCircle;

export interface KicadSymbol {
  name: string;
  primitives: KicadPrimitive[];
  pins: KicadPin[];
  /** Bounding box of all primitives + pin tips */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// ── S-expression tokeniser ──────────────────────────────────────────────────

type SExpr = string | SExpr[];

function tokenise(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
    } else if (ch === '"') {
      // quoted string
      let s = "";
      i++; // skip opening quote
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && i + 1 < text.length) {
          s += text[i + 1];
          i += 2;
        } else {
          s += text[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push(`"${s}"`);
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      // atom
      let s = "";
      while (i < text.length && !/[\s()]/.test(text[i])) {
        s += text[i];
        i++;
      }
      tokens.push(s);
    }
  }
  return tokens;
}

function parseSExpr(tokens: string[], pos: { i: number }): SExpr {
  if (tokens[pos.i] === "(") {
    pos.i++; // skip "("
    const list: SExpr[] = [];
    while (pos.i < tokens.length && tokens[pos.i] !== ")") {
      list.push(parseSExpr(tokens, pos));
    }
    pos.i++; // skip ")"
    return list;
  }
  const tok = tokens[pos.i];
  pos.i++;
  // strip quotes
  if (tok.startsWith('"') && tok.endsWith('"')) {
    return tok.slice(1, -1);
  }
  return tok;
}

function parse(text: string): SExpr {
  const tokens = tokenise(text);
  const pos = { i: 0 };
  return parseSExpr(tokens, pos);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function find(list: SExpr[], tag: string): SExpr[] | null {
  for (const item of list) {
    if (Array.isArray(item) && item[0] === tag) return item;
  }
  return null;
}

function findAll(list: SExpr[], tag: string): SExpr[][] {
  const results: SExpr[][] = [];
  for (const item of list) {
    if (Array.isArray(item) && item[0] === tag) results.push(item);
  }
  return results;
}

function num(v: SExpr): number {
  return typeof v === "string" ? parseFloat(v) : 0;
}

// ── Primitive extractors ────────────────────────────────────────────────────

function extractPolyline(node: SExpr[]): KicadPolyline {
  const ptsNode = find(node, "pts");
  const points: KicadPoint[] = [];
  if (ptsNode) {
    for (const xy of findAll(ptsNode, "xy")) {
      points.push({ x: num(xy[1]), y: num(xy[2]) });
    }
  }
  const strokeNode = find(node, "stroke");
  const widthNode = strokeNode ? find(strokeNode, "width") : null;
  const strokeWidth = widthNode ? num(widthNode[1]) : 0;
  return { type: "polyline", points, strokeWidth };
}

function extractRectangle(node: SExpr[]): KicadRectangle {
  const startNode = find(node, "start")!;
  const endNode = find(node, "end")!;
  const strokeNode = find(node, "stroke");
  const widthNode = strokeNode ? find(strokeNode, "width") : null;
  const fillNode = find(node, "fill");
  const fillType = fillNode ? find(fillNode, "type") : null;
  return {
    type: "rectangle",
    start: { x: num(startNode[1]), y: num(startNode[2]) },
    end: { x: num(endNode[1]), y: num(endNode[2]) },
    strokeWidth: widthNode ? num(widthNode[1]) : 0,
    fill: fillType ? String(fillType[1]) : "none",
  };
}

function extractArc(node: SExpr[]): KicadArc {
  const startNode = find(node, "start")!;
  const midNode = find(node, "mid")!;
  const endNode = find(node, "end")!;
  const strokeNode = find(node, "stroke");
  const widthNode = strokeNode ? find(strokeNode, "width") : null;
  return {
    type: "arc",
    start: { x: num(startNode[1]), y: num(startNode[2]) },
    mid: { x: num(midNode[1]), y: num(midNode[2]) },
    end: { x: num(endNode[1]), y: num(endNode[2]) },
    strokeWidth: widthNode ? num(widthNode[1]) : 0,
  };
}

function extractCircle(node: SExpr[]): KicadCircle {
  const centerNode = find(node, "center")!;
  const radiusNode = find(node, "radius")!;
  const strokeNode = find(node, "stroke");
  const widthNode = strokeNode ? find(strokeNode, "width") : null;
  const fillNode = find(node, "fill");
  const fillType = fillNode ? find(fillNode, "type") : null;
  return {
    type: "circle",
    center: { x: num(centerNode[1]), y: num(centerNode[2]) },
    radius: num(radiusNode[1]),
    strokeWidth: widthNode ? num(widthNode[1]) : 0,
    fill: fillType ? String(fillType[1]) : "none",
  };
}

function extractPin(node: SExpr[]): KicadPin {
  // (pin <type> <style> (at x y angle) (length len) (name "..." ...) (number "..." ...))
  const pinType = String(node[1]);
  const atNode = find(node, "at")!;
  const lengthNode = find(node, "length")!;
  const nameNode = find(node, "name");
  const numberNode = find(node, "number");
  return {
    type: pinType,
    position: { x: num(atNode[1]), y: num(atNode[2]) },
    angle: atNode.length > 3 ? num(atNode[3]) : 0,
    length: num(lengthNode[1]),
    name: nameNode ? String(nameNode[1]) : "",
    number: numberNode ? String(numberNode[1]) : "",
  };
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseKicadSymbol(text: string): KicadSymbol {
  const tree = parse(text);
  if (!Array.isArray(tree) || tree[0] !== "kicad_symbol_lib") {
    throw new Error("Not a valid kicad_symbol_lib file");
  }

  // Find the top-level symbol
  const symbolNode = find(tree, "symbol");
  if (!symbolNode) throw new Error("No symbol found");

  const name = String(symbolNode[1]);
  const primitives: KicadPrimitive[] = [];
  const pins: KicadPin[] = [];

  // KiCad splits drawing into sub-symbols like "R_0_1" (body) and "R_1_1" (pins)
  const subSymbols = findAll(symbolNode, "symbol");

  for (const sub of subSymbols) {
    for (const child of sub) {
      if (!Array.isArray(child)) continue;
      switch (child[0]) {
        case "polyline":
          primitives.push(extractPolyline(child));
          break;
        case "rectangle":
          primitives.push(extractRectangle(child));
          break;
        case "arc":
          primitives.push(extractArc(child));
          break;
        case "circle":
          primitives.push(extractCircle(child));
          break;
        case "pin":
          pins.push(extractPin(child));
          break;
      }
    }
  }

  // Calculate bounding box
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const expandBounds = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const p of primitives) {
    switch (p.type) {
      case "polyline":
        p.points.forEach((pt) => expandBounds(pt.x, pt.y));
        break;
      case "rectangle":
        expandBounds(p.start.x, p.start.y);
        expandBounds(p.end.x, p.end.y);
        break;
      case "arc":
        expandBounds(p.start.x, p.start.y);
        expandBounds(p.mid.x, p.mid.y);
        expandBounds(p.end.x, p.end.y);
        break;
      case "circle":
        expandBounds(p.center.x - p.radius, p.center.y - p.radius);
        expandBounds(p.center.x + p.radius, p.center.y + p.radius);
        break;
    }
  }

  // Include pin tip positions in bounding box
  for (const pin of pins) {
    expandBounds(pin.position.x, pin.position.y);
    // Pin tip extends from position by length in the direction of angle
    const rad = (pin.angle * Math.PI) / 180;
    const tipX = pin.position.x + pin.length * Math.cos(rad);
    const tipY = pin.position.y + pin.length * Math.sin(rad);
    expandBounds(tipX, tipY);
  }

  if (!isFinite(minX)) {
    minX = minY = -5;
    maxX = maxY = 5;
  }

  return {
    name,
    primitives,
    pins,
    bounds: { minX, minY, maxX, maxY },
  };
}

/**
 * Pin tip position: the end of the pin lead line (where wires connect).
 * In KiCad, pin.position is the body end; the tip is at position - length in direction of angle + 180.
 * Actually in KiCad, the pin (at x y angle) gives the connection point and the
 * pin extends INTO the symbol body by `length`. So the connection point IS pin.position
 * and the body-side end is shifted by `length` in the direction `angle`.
 */
export function pinBodyEnd(pin: KicadPin): KicadPoint {
  const rad = (pin.angle * Math.PI) / 180;
  return {
    x: pin.position.x + pin.length * Math.cos(rad),
    y: pin.position.y + pin.length * Math.sin(rad),
  };
}
