"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, AlertTriangle, Play, X } from "lucide-react";
import { useCircuit } from "@/context/circuit-context";
import { useToast } from "@/hooks/use-toast";
import { CircuitValidator, AdvancedNetlistGenerator } from "@/utils";
import { circuitSimulationManager } from "@/services/circuit-simulation-manager";
import { cn } from "@/utils";

interface SimulationValidationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSimulation: (netlist: string) => Promise<void>;
  isSimulating?: boolean;
}

export const SimulationValidationPanel: React.FC<
  SimulationValidationPanelProps
> = ({ isOpen, onClose, onStartSimulation, isSimulating = false }) => {
  const { state: circuit } = useCircuit();
  const { toast } = useToast();
  const [netlist, setNetlist] = useState<string>("");
  const [validationIssues, setValidationIssues] = useState<any[]>([]);
  const [canSimulate, setCanSimulate] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showNetlist, setShowNetlist] = useState(false);

  // Validate on open or circuit change
  useEffect(() => {
    if (isOpen) {
      validateCircuit();
    }
  }, [isOpen, circuit.circuit]);

  const validateCircuit = async () => {
    setIsValidating(true);
    try {
      const result = await circuitSimulationManager.prepareCircuit(
        circuit.circuit
      );

      if (result.isValid && result.netlist) {
        setNetlist(result.netlist);
        setCanSimulate(true);
        setValidationIssues([]);

        // Show warnings if any
        if (result.warnings.length > 0) {
          result.warnings.forEach((warning) => {
            console.warn("Circuit warning:", warning);
          });
        }
      } else {
        setNetlist("");
        setCanSimulate(false);
        setValidationIssues(
          result.errors.map((msg) => ({
            severity: "error",
            message: msg,
          }))
        );

        // Add warnings
        result.warnings.forEach((msg) => {
          validationIssues.push({
            severity: "warning",
            message: msg,
          });
        });
      }
    } catch (error) {
      setCanSimulate(false);
      setNetlist("");
      setValidationIssues([
        {
          severity: "error",
          message: `Validation error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ]);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSimulation = async () => {
    if (!canSimulate || !netlist) {
      toast.error("Circuit validation failed. Please fix the errors.");
      return;
    }

    try {
      await onStartSimulation(netlist);
      onClose();
    } catch (error) {
      toast.error(
        `Simulation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  if (!isOpen) return null;

  const errors = validationIssues.filter((i) => i.severity === "error");
  const warnings = validationIssues.filter((i) => i.severity === "warning");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Play className="w-5 h-5" />
            Circuit Validation & Simulation
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isSimulating}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Validation Status */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              {isValidating && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {!isValidating && canSimulate && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {!isValidating && !canSimulate && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              {isValidating
                ? "Validating Circuit..."
                : canSimulate
                ? "Circuit Valid"
                : "Circuit Issues Found"}
            </h3>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-sm font-medium text-red-600 dark:text-red-400">
                  Errors ({errors.length}):
                </div>
                {errors.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {issue.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Warnings ({warnings.length}):
                </div>
                {warnings.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800"
                  >
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {issue.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {canSimulate && errors.length === 0 && (
              <div className="flex gap-2 p-3 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your circuit is ready for simulation!
                </p>
              </div>
            )}
          </div>

          {/* Circuit Statistics */}
          {canSimulate && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3 bg-gray-50 dark:bg-gray-800">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Components
                </div>
                <div className="text-lg font-semibold">
                  {circuit.circuit.components.length}
                </div>
              </Card>
              <Card className="p-3 bg-gray-50 dark:bg-gray-800">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Connections
                </div>
                <div className="text-lg font-semibold">
                  {circuit.circuit.wires.length}
                </div>
              </Card>
            </div>
          )}

          {/* Netlist Preview */}
          {netlist && (
            <div>
              <button
                onClick={() => setShowNetlist(!showNetlist)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 flex items-center gap-1"
              >
                {showNetlist ? "▼" : "▶"} View Generated Netlist
              </button>
              {showNetlist && (
                <pre className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto font-mono border border-gray-300 dark:border-gray-700 max-h-48">
                  {netlist}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50 dark:bg-gray-800">
          <Button variant="outline" onClick={onClose} disabled={isSimulating}>
            Cancel
          </Button>
          <Button
            onClick={handleSimulation}
            disabled={!canSimulate || isSimulating || isValidating}
            className="flex-1"
          >
            {isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Running Simulation...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Simulation
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SimulationValidationPanel;
