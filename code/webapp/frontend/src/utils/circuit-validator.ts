import { Circuit, CircuitComponent, Wire } from "@/types/circuit";

/**
 * Circuit validation for design rule checks and simulation readiness
 */
export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  componentId?: string;
  wireId?: string;
}

export class CircuitValidator {
  /**
   * Comprehensive circuit validation
   */
  static validate(circuit: Circuit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check basic circuit structure
    if (!circuit.components || circuit.components.length === 0) {
      issues.push({
        severity: "error",
        message: "Circuit has no components. Add at least one component.",
      });
      return issues;
    }

    // Check for power sources
    issues.push(...this.validatePowerSources(circuit));

    // Check for ground
    issues.push(...this.validateGround(circuit));

    // Check for disconnected components
    issues.push(...this.validateConnectivity(circuit));

    // Check component properties
    issues.push(...this.validateComponentProperties(circuit));

    // Check wires
    issues.push(...this.validateWires(circuit));

    return issues;
  }

  /**
   * Check for at least one voltage source
   */
  private static validatePowerSources(circuit: Circuit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const hasVoltageSource = circuit.components.some(
      (c) => c.type === "battery"
    );

    if (!hasVoltageSource) {
      issues.push({
        severity: "error",
        message:
          "Circuit must have at least one voltage source (battery). Add a battery component.",
      });
    }

    return issues;
  }

  /**
   * Check for ground node
   */
  private static validateGround(circuit: Circuit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const hasGround = circuit.components.some((c) => c.type === "ground");

    if (!hasGround) {
      issues.push({
        severity: "error",
        message:
          "Circuit must have a ground node. Add a ground component connected to the negative side of your circuit.",
      });
    }

    return issues;
  }

  /**
   * Check if critical components are connected
   */
  private static validateConnectivity(circuit: Circuit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!circuit.wires) {
      issues.push({
        severity: "error",
        message:
          "Circuit has no wires. Connect components with wires to form a complete circuit.",
      });
      return issues;
    }

    const connectedComponents = new Set<string>();
    circuit.wires.forEach((wire) => {
      if (wire.from) connectedComponents.add(wire.from.componentId);
      if (wire.to) connectedComponents.add(wire.to.componentId);
    });

    // Check if critical components are isolated
    circuit.components.forEach((component) => {
      if (!connectedComponents.has(component.id)) {
        // Ground can be disconnected (it's the reference)
        if (component.type !== "ground") {
          issues.push({
            severity: "warning",
            message: `Component "${
              component.label || component.type
            }" is not connected to any wire.`,
            componentId: component.id,
          });
        }
      }
    });

    return issues;
  }

  /**
   * Validate component properties
   */
  private static validateComponentProperties(
    circuit: Circuit
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    circuit.components.forEach((component) => {
      // Check for required properties
      switch (component.type) {
        case "resistor":
          const resistance = component.properties.resistance;
          if (!resistance || (resistance as number) <= 0) {
            issues.push({
              severity: "error",
              message: `Resistor "${
                component.label || component.id
              }" has invalid resistance value. Resistance must be > 0.`,
              componentId: component.id,
            });
          }
          break;

        case "capacitor":
          const capacitance = component.properties.capacitance;
          if (!capacitance || (capacitance as number) <= 0) {
            issues.push({
              severity: "warning",
              message: `Capacitor "${
                component.label || component.id
              }" has invalid capacitance value.`,
              componentId: component.id,
            });
          }
          break;

        case "battery":
          const voltage = component.properties.voltage;
          if (voltage === undefined || voltage === null) {
            issues.push({
              severity: "error",
              message: `Battery "${
                component.label || component.id
              }" has no voltage specified.`,
              componentId: component.id,
            });
          }
          break;

        case "inductor":
          const inductance = component.properties.inductance;
          if (!inductance || (inductance as number) <= 0) {
            issues.push({
              severity: "warning",
              message: `Inductor "${
                component.label || component.id
              }" has invalid inductance value.`,
              componentId: component.id,
            });
          }
          break;
      }

      // Check for minimum terminals
      if (
        component.terminals &&
        component.terminals.length < 2 &&
        component.type !== "ground"
      ) {
        issues.push({
          severity: "error",
          message: `Component "${
            component.label || component.type
          }" must have at least 2 terminals.`,
          componentId: component.id,
        });
      }
    });

    return issues;
  }

  /**
   * Validate wires and connections
   */
  private static validateWires(circuit: Circuit): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!circuit.wires) return issues;

    // Check for self-loops (wire connecting same terminal twice)
    circuit.wires.forEach((wire) => {
      if (
        wire.from && wire.to &&
        wire.from.componentId === wire.to.componentId &&
        wire.from.terminalId === wire.to.terminalId
      ) {
        issues.push({
          severity: "error",
          message: "Wire creates a self-loop. Check your connections.",
          wireId: wire.id,
        });
      }
    });

    return issues;
  }

  /**
   * Get readiness status for simulation
   */
  static getReadinessStatus(circuit: Circuit): {
    canSimulate: boolean;
    issues: ValidationIssue[];
  } {
    const issues = this.validate(circuit);
    const errors = issues.filter((i) => i.severity === "error");

    return {
      canSimulate: errors.length === 0,
      issues,
    };
  }

  /**
   * Format validation issues for display
   */
  static formatIssues(issues: ValidationIssue[]): {
    errors: string[];
    warnings: string[];
    infos: string[];
  } {
    return {
      errors: issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message),
      warnings: issues
        .filter((i) => i.severity === "warning")
        .map((i) => i.message),
      infos: issues.filter((i) => i.severity === "info").map((i) => i.message),
    };
  }
}

export const circuitValidator = {
  validate: CircuitValidator.validate,
  getReadinessStatus: CircuitValidator.getReadinessStatus,
  formatIssues: CircuitValidator.formatIssues,
};
