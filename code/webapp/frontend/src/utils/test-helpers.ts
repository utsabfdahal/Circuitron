/**
 * Test utilities for simulation workflow
 */

export function createSampleCircuit() {
  return {
    components: [
      {
        id: "voltage_source_1",
        type: "voltage_source",
        position: { x: 100, y: 200, rotation: 0 },
        properties: { voltage: 5 },
        terminals: [
          { id: "positive", position: { x: 120, y: 200 }, type: "output" },
          { id: "negative", position: { x: 80, y: 200 }, type: "output" },
        ],
        label: "V1",
      },
      {
        id: "resistor_1",
        type: "resistor",
        position: { x: 200, y: 200, rotation: 0 },
        properties: { resistance: 1000 },
        terminals: [
          {
            id: "terminal1",
            position: { x: 180, y: 200 },
            type: "bidirectional",
          },
          {
            id: "terminal2",
            position: { x: 220, y: 200 },
            type: "bidirectional",
          },
        ],
        label: "R1",
      },
    ],
    wires: [
      {
        id: "wire_1",
        from: { componentId: "voltage_source_1", terminalId: "positive" },
        to: { componentId: "resistor_1", terminalId: "terminal1" },
        points: [
          { x: 120, y: 200 },
          { x: 180, y: 200 },
        ],
      },
      {
        id: "wire_2",
        from: { componentId: "resistor_1", terminalId: "terminal2" },
        to: { componentId: "voltage_source_1", terminalId: "negative" },
        points: [
          { x: 220, y: 200 },
          { x: 220, y: 250 },
          { x: 80, y: 250 },
          { x: 80, y: 200 },
        ],
      },
    ],
    textElements: [],
  };
}

export function createSampleProbe() {
  return {
    id: "probe_output",
    type: "voltage" as const,
    position: { x: 220, y: 180 },
    nodeId: "output",
    label: "Output Voltage",
    isVisible: true,
  };
}

export function generateSampleNetlist(): string {
  return `* Sample RC Circuit for Testing
V1 1 0 DC 5
R1 1 2 1000
* Output probe at node 2
.tran 0.001 1
.end`;
}
