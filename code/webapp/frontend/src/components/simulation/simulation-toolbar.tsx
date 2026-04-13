"use client";

import React, { useState } from "react";
import { Play, Settings, Target, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  EnhancedSimulationModal,
  EnhancedSimulationSettings,
} from "./enhanced-simulation-modal";
import { SimulationValidationPanel } from "./simulation-validation-panel";
import { useSimulation } from "@/hooks/use-simulation";
import { useProbes } from "@/context/probe-context";
import { useToast } from "@/hooks/use-toast";
import { useSimulationModal } from "@/context/simulation-modal-context";
import { useCircuit } from "@/context/circuit-context";

interface SimulationToolbarProps {
  className?: string;
}

export const SimulationToolbar: React.FC<SimulationToolbarProps> = ({
  className,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const { simulationState, runSimulationWithSettings } = useSimulation();
  const { probes } = useProbes();
  const { toast } = useToast();
  const { setIsModalOpen } = useSimulationModal();
  const { state: circuit } = useCircuit();

  const handleRunSimulation = (settings: EnhancedSimulationSettings) => {
    // Convert enhanced settings to original format for compatibility
    const originalSettings = {
      analysisType: settings.analysisType,
      measurementTypes: settings.measurementTypes,
      parameters: settings.parameters,
    };
    runSimulationWithSettings(originalSettings);
  };

  const handleOpenValidation = () => {
    if (circuit.circuit.components.length === 0) {
      toast.error("Circuit is empty. Add components before simulating.");
      return;
    }
    setIsValidationOpen(true);
  };

  const handleStartSimulation = async (netlist: string) => {
    setIsSimulating(true);
    try {
      // Show simulation settings modal after validation
      setIsSettingsOpen(true);
      toast.success("Circuit validated! Configure simulation settings.");
    } catch (error) {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCloseModal = () => {
    setIsSettingsOpen(false);
  };

  return (
    <>
      <div className={className}>
        <div className="flex items-center gap-2">
          {/* Probe Management Icon */}
          <Tooltip content={`Probes: ${probes.length} placed`} side="bottom">
            <Button
              variant="ghost"
              size="sm"
              className={`flex items-center gap-1 ${
                probes.length === 0 ? "text-red-500" : "text-green-500"
              }`}
            >
              <Target className="w-4 h-4" />
              <span className="text-xs">{probes.length}</span>
            </Button>
          </Tooltip>

          {/* Run Simulation Button */}
          <Button
            onClick={handleOpenValidation}
            disabled={simulationState.isRunning || isSimulating}
            className="flex items-center gap-2"
          >
            {simulationState.isRunning || isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="text-sm">Run Simulation</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Validation Panel - Shows circuit validation and netlist generation */}
      <SimulationValidationPanel
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        onStartSimulation={handleStartSimulation}
        isSimulating={isSimulating}
      />

      {/* Settings Modal - Shows simulation parameters */}
      <EnhancedSimulationModal
        isOpen={isSettingsOpen}
        onClose={handleCloseModal}
        onRunSimulation={handleRunSimulation}
      />
    </>
  );
};
