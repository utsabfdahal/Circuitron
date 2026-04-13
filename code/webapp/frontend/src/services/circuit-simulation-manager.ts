import { Circuit } from "@/types/circuit";
import { simulationAPI } from "./simulation-api";
import {
  AdvancedNetlistGenerator,
  NetlistValidator,
} from "@/utils/netlist-generator";
import { CircuitValidator } from "@/utils/circuit-validator";

/**
 * Complete circuit-to-simulation workflow manager
 * Handles validation, netlist generation, and backend API calls
 */
export class CircuitSimulationManager {
  /**
   * Prepare circuit for simulation with full validation
   */
  static async prepareCircuit(circuit: Circuit): Promise<{
    isValid: boolean;
    netlist?: string;
    errors: string[];
    warnings: string[];
  }> {
    // Validate circuit structure
    const validation = CircuitValidator.getReadinessStatus(circuit);

    if (!validation.canSimulate) {
      const formatted = CircuitValidator.formatIssues(validation.issues);
      return {
        isValid: false,
        errors: formatted.errors,
        warnings: formatted.warnings,
      };
    }

    // Generate netlist
    try {
      const result = AdvancedNetlistGenerator.generateWithValidation(circuit);

      if (result.errors.length > 0) {
        return {
          isValid: false,
          errors: result.errors,
          warnings: result.warnings,
        };
      }

      // Validate generated netlist
      const netlsitValidation = NetlistValidator.validate(result.netlist);

      if (!netlsitValidation.isValid) {
        return {
          isValid: false,
          netlist: result.netlist,
          errors: netlsitValidation.errors,
          warnings: result.warnings,
        };
      }

      return {
        isValid: true,
        netlist: result.netlist,
        errors: [],
        warnings: result.warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Netlist generation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
        warnings: [],
      };
    }
  }

  /**
   * Run complete simulation workflow
   */
  static async runSimulation(
    circuit: Circuit,
    probes: any[],
    analysisType: "dc" | "ac" | "transient" | "operational" = "transient",
    parameters: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    result?: any;
    netlist?: string;
    error?: string;
  }> {
    try {
      // Step 1: Prepare circuit
      const preparation = await this.prepareCircuit(circuit);

      if (!preparation.isValid) {
        return {
          success: false,
          error: `Circuit validation failed:\n${preparation.errors.join("\n")}`,
        };
      }

      console.log("Prepared netlist:", preparation.netlist);

      // Step 2: Run simulation via API
      const simulationRequest = {
        circuit,
        analysisType,
        measurementTypes: ["voltage" as const, "current" as const],
        parameters,
        probes,
      };

      const result = await simulationAPI.startSimulation(simulationRequest);

      return {
        success: result.status === "completed",
        result,
        netlist: preparation.netlist,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: `Simulation execution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Get netlist for circuit (useful for viewing/debugging)
   */
  static getNetlist(circuit: Circuit): string {
    return AdvancedNetlistGenerator.generateNetlist(circuit);
  }

  /**
   * Validate netlist with backend
   */
  static async validateNetlistWithBackend(netlist: string): Promise<{
    isValid: boolean;
    issues?: string[];
  }> {
    try {
      const result = await simulationAPI.validateNetlist(netlist);
      return {
        isValid: result.is_valid,
        issues: result.issues,
      };
    } catch (error) {
      return {
        isValid: false,
        issues: [
          `Validation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }
}

/**
 * Backend simulation service with enhanced error handling
 */
export class BackendSimulationService {
  private static baseURL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  /**
   * Submit simulation job to backend
   */
  static async submitSimulation(
    netlist: string,
    analysisType: string
  ): Promise<{
    jobId: string;
    status: string;
  }> {
    const response = await fetch(`${this.baseURL}/api/v1/simulation/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        netlist,
        analysis_type: analysisType,
        parameters: {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Poll simulation status
   */
  static async getSimulationStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: any;
    error?: string;
  }> {
    const response = await fetch(
      `${this.baseURL}/api/v1/simulation/${jobId}/results`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get simulation status: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Cancel running simulation
   */
  static async cancelSimulation(jobId: string): Promise<void> {
    const response = await fetch(
      `${this.baseURL}/api/v1/simulation/${jobId}/stop`,
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error(`Failed to cancel simulation: ${response.statusText}`);
    }
  }

  /**
   * Export simulation results
   */
  static async exportResults(
    jobId: string,
    format: "csv" | "json" = "csv"
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseURL}/api/v1/simulation/${jobId}/export?format=${format}`
    );

    if (!response.ok) {
      throw new Error(`Failed to export results: ${response.statusText}`);
    }

    return response.blob();
  }
}

export const circuitSimulationManager = CircuitSimulationManager;
export const backendSimulationService = BackendSimulationService;
