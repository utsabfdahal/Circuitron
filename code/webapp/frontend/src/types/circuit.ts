export interface Point {
  x: number;
  y: number;
}

export interface ComponentPosition {
  x: number;
  y: number;
  rotation: number;
}

export interface ComponentTerminal {
  id: string;
  position: Point;
  type: "input" | "output" | "bidirectional";
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  position: ComponentPosition;
  properties: Record<string, string | number | boolean>;
  terminals: ComponentTerminal[];
  label?: string;
  /** Scale factor for the component symbol (default 1). Used to shrink/inflate the symbol to fit between its connection points. */
  symbolScale?: number;
}

export interface TextElement {
  id: string;
  position: Point;
  text: string;
  fontSize: number;
  fontFamily?: string;
  color?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  textAlign?: "left" | "center" | "right";
}

export interface Wire {
  id: string;
  /** Optional: connected to a component terminal at the start */
  from?: {
    componentId: string;
    terminalId: string;
  };
  /** Optional: connected to a component terminal at the end */
  to?: {
    componentId: string;
    terminalId: string;
  };
  /** Ordered list of points forming the wire path (at least 2) */
  points: Point[];
}

export interface Circuit {
  id: string;
  name: string;
  components: CircuitComponent[];
  wires: Wire[];
  textElements: TextElement[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
  };
}

export type ComponentType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "diode"
  | "led"
  | "battery"
  | "switch"
  | "ground"
  | "voltmeter"
  | "ammeter"
  | "and_gate"
  | "or_gate"
  | "not_gate"
  | "nand_gate"
  | "nor_gate"
  | "xor_gate"
  | "npn_transistor"
  | "pnp_transistor"
  | "nmos_transistor"
  | "pmos_transistor";

export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  category: "passive" | "active" | "source" | "meter" | "logic" | "transistor";
  defaultProperties: Record<string, string | number | boolean>;
  terminals: Omit<ComponentTerminal, "id" | "position">[];
  icon: string;
}

export interface Tool {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
}

export type ToolType =
  | "select"
  | "wire"
  | "component"
  | "text"
  | "zoom"
  | "pan"
  | "eraser";

export interface ViewState {
  zoom: number;
  pan: Point;
  selectedTool: ToolType;
  selectedComponents: string[];
  selectedTextElements: string[];
  gridVisible: boolean;
  snapToGrid: boolean;
}
