/**
 * Simulation API Service
 * Handles communication with FastAPI backend for circuit simulation
 */

export interface SimulationRequest {
  circuit: {
    components: any[];
    wires: any[];
    textElements?: any[];
  };
  analysisType: "dc" | "ac" | "transient" | "operational";
  parameters: {
    startTime?: number;
    endTime?: number;
    timeStep?: number;
    startFreq?: number;
    endFreq?: number;
    freqStep?: number;
    startVoltage?: number;
    endVoltage?: number;
    voltageStep?: number;
    // Operational analysis parameters
    temperature?: number;
    sweepVariable?: string;
    sweepStart?: number;
    sweepEnd?: number;
    sweepStep?: number;
  };
  measurementTypes: ("voltage" | "current" | "power")[];
  probes?: {
    id: string;
    type: "voltage" | "current" | "power";
    nodeId?: string;
    componentId?: string;
    label: string;
    position: { x: number; y: number };
  }[];
}

export interface SimulationResult {
  id: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  netlist?: string;
  data: {
    time?: number[];
    frequency?: number[];
    voltage?: { [nodeId: string]: number[] };
    current?: { [componentId: string]: number[] };
    power?: { [componentId: string]: number[] };
  };
  metadata: {
    analysisType: string;
    duration: number;
    nodes: string[];
    components: string[];
  };
  error?: string;
}

export interface WaveformData {
  name: string;
  data: { x: number; y: number }[];
  unit: string;
  color: string;
  type: "voltage" | "current" | "power";
  probeId?: string;
}

class SimulationAPIService {
  private baseURL: string;

  constructor() {
    // Will be configurable based on environment
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }

  /**
   * Start a new simulation
   */
  async startSimulation(request: SimulationRequest): Promise<SimulationResult> {
    try {
      const response = await fetch(`${this.baseURL}/api/simulation/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Simulation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Failed to start simulation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get simulation status and results
   */
  async getSimulationResult(simulationId: string): Promise<SimulationResult> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/simulation/${simulationId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get simulation: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Failed to get simulation result: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Stop a running simulation
   */
  async stopSimulation(simulationId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/simulation/${simulationId}/stop`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to stop simulation: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to stop simulation: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download simulation results in various formats
   */
  async downloadResults(
    simulationId: string,
    format: "csv" | "json" | "png"
  ): Promise<Blob> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/simulation/${simulationId}/download?format=${format}`
      );

      if (!response.ok) {
        throw new Error(`Failed to download results: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      throw new Error(
        `Failed to download results: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download generated netlist
   */
  async downloadNetlist(simulationId: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/simulation/${simulationId}/netlist`
      );

      if (!response.ok) {
        throw new Error(`Failed to download netlist: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(
        `Failed to download netlist: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get available analysis types and their parameters
   */
  async getAnalysisTypes(): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/simulation/analysis-types`
      );

      if (!response.ok) {
        throw new Error(`Failed to get analysis types: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Failed to get analysis types: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Convert simulation data to waveform format for charts, filtered by probes
   */
  convertToWaveforms(
    result: SimulationResult,
    probes?: {
      id: string;
      type: "voltage" | "current" | "power";
      nodeId?: string;
      componentId?: string;
      label: string;
      position: { x: number; y: number };
    }[]
  ): WaveformData[] {
    const waveforms: WaveformData[] = [];

    // If probes are provided, only show data for probed points
    if (probes && probes.length > 0) {
      probes.forEach((probe, index) => {
        const timeData = result.data.time || [];

        if (
          probe.type === "voltage" &&
          probe.nodeId &&
          result.data.voltage?.[probe.nodeId]
        ) {
          const values = result.data.voltage[probe.nodeId];
          waveforms.push({
            name: probe.label || `V(${probe.nodeId})`,
            data: values.map((y, i) => ({ x: timeData[i] || i, y })),
            unit: "V",
            color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
            type: "voltage",
            probeId: probe.id,
          });
        }

        if (
          probe.type === "current" &&
          probe.componentId &&
          result.data.current?.[probe.componentId]
        ) {
          const values = result.data.current[probe.componentId];
          waveforms.push({
            name: probe.label || `I(${probe.componentId})`,
            data: values.map((y, i) => ({ x: timeData[i] || i, y })),
            unit: "A",
            color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
            type: "current",
            probeId: probe.id,
          });
        }

        if (
          probe.type === "power" &&
          probe.componentId &&
          result.data.power?.[probe.componentId]
        ) {
          const values = result.data.power[probe.componentId];
          waveforms.push({
            name: probe.label || `P(${probe.componentId})`,
            data: values.map((y, i) => ({ x: timeData[i] || i, y })),
            unit: "W",
            color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
            type: "power",
            probeId: probe.id,
          });
        }
      });
    } else {
      // Fallback to original behavior if no probes specified
      // Convert voltage data
      if (result.data.voltage) {
        Object.entries(result.data.voltage).forEach(
          ([nodeId, values], index) => {
            const timeData = result.data.time || [];
            waveforms.push({
              name: `V(${nodeId})`,
              data: values.map((y, i) => ({ x: timeData[i] || i, y })),
              unit: "V",
              color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
              type: "voltage",
            });
          }
        );
      }

      // Convert current data
      if (result.data.current) {
        Object.entries(result.data.current).forEach(
          ([componentId, values], index) => {
            const timeData = result.data.time || [];
            waveforms.push({
              name: `I(${componentId})`,
              data: values.map((y, i) => ({ x: timeData[i] || i, y })),
              unit: "A",
              color: `hsl(${
                ((index + Object.keys(result.data.voltage || {}).length) * 60) %
                360
              }, 70%, 50%)`,
              type: "current",
            });
          }
        );
      }
    }

    return waveforms;
  }
}

// Export singleton instance
export const simulationAPI = new SimulationAPIService();
export default simulationAPI;
