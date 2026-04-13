import { ComponentDefinition, ComponentType } from "@/types/circuit";

export const COMPONENT_DEFINITIONS: Record<ComponentType, ComponentDefinition> =
  {
    resistor: {
      type: "resistor",
      name: "Resistor",
      category: "passive",
      defaultProperties: { resistance: 1000, unit: "Ω" },
      terminals: [{ type: "bidirectional" }, { type: "bidirectional" }],
      icon: "📐",
    },
    capacitor: {
      type: "capacitor",
      name: "Capacitor",
      category: "passive",
      defaultProperties: { capacitance: 1e-6, unit: "F" },
      terminals: [{ type: "bidirectional" }, { type: "bidirectional" }],
      icon: "🔋",
    },
    inductor: {
      type: "inductor",
      name: "Inductor",
      category: "passive",
      defaultProperties: { inductance: 1e-3, unit: "H" },
      terminals: [{ type: "bidirectional" }, { type: "bidirectional" }],
      icon: "🌊",
    },
    diode: {
      type: "diode",
      name: "Diode",
      category: "active",
      defaultProperties: { forwardVoltage: 0.7, unit: "V" },
      terminals: [{ type: "input" }, { type: "output" }],
      icon: "🔺",
    },
    led: {
      type: "led",
      name: "LED",
      category: "active",
      defaultProperties: { forwardVoltage: 2.1, color: "red" },
      terminals: [{ type: "input" }, { type: "output" }],
      icon: "💡",
    },
    battery: {
      type: "battery",
      name: "Battery",
      category: "source",
      defaultProperties: { voltage: 9, unit: "V" },
      terminals: [{ type: "output" }, { type: "input" }],
      icon: "🔋",
    },
    switch: {
      type: "switch",
      name: "Switch",
      category: "active",
      defaultProperties: { state: "open" },
      terminals: [{ type: "bidirectional" }, { type: "bidirectional" }],
      icon: "🔘",
    },
    ground: {
      type: "ground",
      name: "Ground",
      category: "source",
      defaultProperties: {},
      terminals: [{ type: "input" }],
      icon: "⏚",
    },
    voltmeter: {
      type: "voltmeter",
      name: "Voltmeter",
      category: "meter",
      defaultProperties: { range: 10, unit: "V" },
      terminals: [{ type: "input" }, { type: "input" }],
      icon: "📊",
    },
    ammeter: {
      type: "ammeter",
      name: "Ammeter",
      category: "meter",
      defaultProperties: { range: 1, unit: "A" },
      terminals: [{ type: "bidirectional" }, { type: "bidirectional" }],
      icon: "📈",
    },
    and_gate: {
      type: "and_gate",
      name: "AND Gate",
      category: "logic",
      defaultProperties: {},
      terminals: [{ type: "input" }, { type: "input" }, { type: "output" }],
      icon: "∧",
    },
    or_gate: {
      type: "or_gate",
      name: "OR Gate",
      category: "logic",
      defaultProperties: {},
      terminals: [{ type: "input" }, { type: "input" }, { type: "output" }],
      icon: "∨",
    },
    not_gate: {
      type: "not_gate",
      name: "NOT Gate",
      category: "logic",
      defaultProperties: {},
      terminals: [{ type: "input" }, { type: "output" }],
      icon: "¬",
    },
    nand_gate: {
      type: "nand_gate",
      name: "NAND Gate",
      category: "logic",
      defaultProperties: {},
      terminals: [{ type: "input" }, { type: "input" }, { type: "output" }],
      icon: "⊼",
    },
    nor_gate: {
      type: "nor_gate",
      name: "NOR Gate",
      category: "logic",
      defaultProperties: {},
      terminals: [{ type: "input" }, { type: "input" }, { type: "output" }],
      icon: "⊽",
    },
    xor_gate: {
      type: "xor_gate",
      name: "XOR Gate",
      category: "logic",
      defaultProperties: {},
      terminals: [{ type: "input" }, { type: "input" }, { type: "output" }],
      icon: "⊕",
    },
    npn_transistor: {
      type: "npn_transistor",
      name: "NPN Transistor",
      category: "transistor",
      defaultProperties: { hfe: 100, model: "2N2222" },
      terminals: [
        { type: "input" },       // Base
        { type: "output" },      // Collector
        { type: "output" },      // Emitter
      ],
      icon: "🔲",
    },
    pnp_transistor: {
      type: "pnp_transistor",
      name: "PNP Transistor",
      category: "transistor",
      defaultProperties: { hfe: 100, model: "2N2907" },
      terminals: [
        { type: "input" },       // Base
        { type: "output" },      // Collector
        { type: "output" },      // Emitter
      ],
      icon: "🔲",
    },
    nmos_transistor: {
      type: "nmos_transistor",
      name: "NMOS Transistor",
      category: "transistor",
      defaultProperties: { model: "IRF540" },
      terminals: [
        { type: "input" },       // Gate
        { type: "output" },      // Drain
        { type: "output" },      // Source
      ],
      icon: "🔲",
    },
    pmos_transistor: {
      type: "pmos_transistor",
      name: "PMOS Transistor",
      category: "transistor",
      defaultProperties: { model: "IRF9540" },
      terminals: [
        { type: "input" },       // Gate
        { type: "output" },      // Drain
        { type: "output" },      // Source
      ],
      icon: "🔲",
    },
  };

export const COMPONENT_CATEGORIES = {
  passive: "Passive Components",
  active: "Active Components",
  source: "Sources",
  meter: "Meters",
  logic: "Logic Gates",
  transistor: "Transistors",
};

export const GRID_SIZE = 10;
export const CANVAS_SIZE = { width: 2000, height: 1500 };
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;

/**
 * Scale from KiCad millimetres → canvas pixels.
 * 1 KiCad mm ≈ 10 canvas px  →  standard 0.1″ grid = 25.4 px ≈ 2.5 grid cells.
 */
export const KICAD_SCALE = 10;
