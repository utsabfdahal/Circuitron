"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs } from "@/components/ui/tabs";
import { useProbes } from "@/context/probe-context";
import { useSimulation } from "@/hooks/use-simulation";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  Play,
  Settings,
  Zap,
  TrendingUp,
  Activity,
  Calculator,
} from "lucide-react";
import { cn } from "@/utils";

export interface SimulationSettings {
  analysisType: "dc" | "ac" | "transient" | "operational";
  measurementTypes: ("voltage" | "current" | "power")[];
  parameters: {
    // Transient Analysis
    startTime?: number;
    endTime?: number;
    timeStep?: number;
    // AC Analysis
    startFreq?: number;
    endFreq?: number;
    freqStep?: number;
    // DC Analysis
    startVoltage?: number;
    endVoltage?: number;
    voltageStep?: number;
    // Operational Analysis
    temperature?: number;
    sweepVariable?: string;
    sweepStart?: number;
    sweepEnd?: number;
    sweepStep?: number;
  };
}

interface SimulationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSimulation: (settings: SimulationSettings) => void;
}

export const SimulationSettingsModal: React.FC<
  SimulationSettingsModalProps
> = ({ isOpen, onClose, onRunSimulation }) => {
  const { probes } = useProbes();
  const { simulationState } = useSimulation();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SimulationSettings>({
    analysisType: "transient",
    measurementTypes: ["voltage"],
    parameters: {
      // Default transient parameters
      startTime: 0,
      endTime: 1,
      timeStep: 0.001,
      // Default AC parameters
      startFreq: 1,
      endFreq: 1000,
      freqStep: 1,
      // Default DC parameters
      startVoltage: 0,
      endVoltage: 5,
      voltageStep: 0.1,
      // Default operational parameters
      temperature: 25,
      sweepVariable: "voltage",
      sweepStart: 0,
      sweepEnd: 5,
      sweepStep: 0.1,
    },
  });

  const analysisTypes = [
    {
      id: "transient" as const,
      name: "Transient Analysis",
      description: "Analyze circuit behavior over time",
      icon: Activity,
    },
    {
      id: "ac" as const,
      name: "AC Analysis",
      description: "Frequency domain analysis",
      icon: TrendingUp,
    },
    {
      id: "dc" as const,
      name: "DC Analysis",
      description: "DC operating point and sweep",
      icon: Zap,
    },
    {
      id: "operational" as const,
      name: "Operational Analysis",
      description: "Operating point and parameter sweeps",
      icon: Calculator,
    },
  ];

  const measurementOptions = [
    {
      id: "voltage" as const,
      name: "Voltage",
      description: "Measure voltage across nodes",
      unit: "V",
    },
    {
      id: "current" as const,
      name: "Current",
      description: "Measure current through components",
      unit: "A",
    },
    {
      id: "power" as const,
      name: "Power",
      description: "Measure power consumption",
      unit: "W",
    },
  ];

  const handleAnalysisTypeChange = (
    analysisType: SimulationSettings["analysisType"]
  ) => {
    setSettings((prev) => ({
      ...prev,
      analysisType,
    }));
  };

  const handleMeasurementTypeToggle = (
    measurementType: "voltage" | "current" | "power"
  ) => {
    setSettings((prev) => ({
      ...prev,
      measurementTypes: prev.measurementTypes.includes(measurementType)
        ? prev.measurementTypes.filter((type) => type !== measurementType)
        : [...prev.measurementTypes, measurementType],
    }));
  };

  const handleParameterChange = (
    parameter: keyof SimulationSettings["parameters"],
    value: number | string
  ) => {
    setSettings((prev) => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [parameter]: value,
      },
    }));
  };

  const handleRunSimulation = () => {
    // Validate settings
    if (probes.length === 0) {
      toast.error("Please place at least one probe before running simulation.");
      return;
    }

    if (settings.measurementTypes.length === 0) {
      toast.error("Please select at least one measurement type.");
      return;
    }

    onRunSimulation(settings);
    onClose();
  };

  const renderParameterInputs = () => {
    switch (settings.analysisType) {
      case "transient":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time (s)</Label>
                <Input
                  id="startTime"
                  type="number"
                  step="0.001"
                  value={settings.parameters.startTime || 0}
                  onChange={(e) =>
                    handleParameterChange(
                      "startTime",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time (s)</Label>
                <Input
                  id="endTime"
                  type="number"
                  step="0.001"
                  value={settings.parameters.endTime || 1}
                  onChange={(e) =>
                    handleParameterChange("endTime", parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="timeStep">Time Step (s)</Label>
              <Input
                id="timeStep"
                type="number"
                step="0.0001"
                value={settings.parameters.timeStep || 0.001}
                onChange={(e) =>
                  handleParameterChange("timeStep", parseFloat(e.target.value))
                }
              />
            </div>
          </div>
        );

      case "ac":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startFreq">Start Frequency (Hz)</Label>
                <Input
                  id="startFreq"
                  type="number"
                  value={settings.parameters.startFreq || 1}
                  onChange={(e) =>
                    handleParameterChange(
                      "startFreq",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="endFreq">End Frequency (Hz)</Label>
                <Input
                  id="endFreq"
                  type="number"
                  value={settings.parameters.endFreq || 1000}
                  onChange={(e) =>
                    handleParameterChange("endFreq", parseFloat(e.target.value))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="freqStep">Frequency Step (Hz)</Label>
              <Input
                id="freqStep"
                type="number"
                value={settings.parameters.freqStep || 1}
                onChange={(e) =>
                  handleParameterChange("freqStep", parseFloat(e.target.value))
                }
              />
            </div>
          </div>
        );

      case "dc":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startVoltage">Start Voltage (V)</Label>
                <Input
                  id="startVoltage"
                  type="number"
                  step="0.1"
                  value={settings.parameters.startVoltage || 0}
                  onChange={(e) =>
                    handleParameterChange(
                      "startVoltage",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="endVoltage">End Voltage (V)</Label>
                <Input
                  id="endVoltage"
                  type="number"
                  step="0.1"
                  value={settings.parameters.endVoltage || 5}
                  onChange={(e) =>
                    handleParameterChange(
                      "endVoltage",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="voltageStep">Voltage Step (V)</Label>
              <Input
                id="voltageStep"
                type="number"
                step="0.01"
                value={settings.parameters.voltageStep || 0.1}
                onChange={(e) =>
                  handleParameterChange(
                    "voltageStep",
                    parseFloat(e.target.value)
                  )
                }
              />
            </div>
          </div>
        );

      case "operational":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="temperature">Temperature (°C)</Label>
              <Input
                id="temperature"
                type="number"
                value={settings.parameters.temperature || 25}
                onChange={(e) =>
                  handleParameterChange(
                    "temperature",
                    parseFloat(e.target.value)
                  )
                }
              />
            </div>
            <div>
              <Label htmlFor="sweepVariable">Sweep Variable</Label>
              <select
                id="sweepVariable"
                className="w-full p-2 border rounded-md"
                value={settings.parameters.sweepVariable || "voltage"}
                onChange={(e) =>
                  handleParameterChange("sweepVariable", e.target.value)
                }
              >
                <option value="voltage">Voltage</option>
                <option value="current">Current</option>
                <option value="resistance">Resistance</option>
                <option value="temperature">Temperature</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="sweepStart">Start Value</Label>
                <Input
                  id="sweepStart"
                  type="number"
                  step="0.1"
                  value={settings.parameters.sweepStart || 0}
                  onChange={(e) =>
                    handleParameterChange(
                      "sweepStart",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="sweepEnd">End Value</Label>
                <Input
                  id="sweepEnd"
                  type="number"
                  step="0.1"
                  value={settings.parameters.sweepEnd || 5}
                  onChange={(e) =>
                    handleParameterChange(
                      "sweepEnd",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="sweepStep">Step Size</Label>
                <Input
                  id="sweepStep"
                  type="number"
                  step="0.01"
                  value={settings.parameters.sweepStep || 0.1}
                  onChange={(e) =>
                    handleParameterChange(
                      "sweepStep",
                      parseFloat(e.target.value)
                    )
                  }
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Simulation Settings</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Probe Summary */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Placed Probes</h3>
              {probes.length === 0 ? (
                <p className="text-muted-foreground">
                  No probes placed. Please place probes on your circuit before
                  running simulation.
                </p>
              ) : (
                <div className="space-y-2">
                  {probes.map((probe) => (
                    <div key={probe.id} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: probe.color }}
                      />
                      <span className="font-medium">{probe.label}</span>
                      <span className="text-sm text-muted-foreground">
                        ({probe.type})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Analysis Type Selection */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Analysis Type</h3>
              <div className="grid grid-cols-2 gap-4">
                {analysisTypes.map((analysis) => {
                  const Icon = analysis.icon;
                  return (
                    <button
                      key={analysis.id}
                      onClick={() => handleAnalysisTypeChange(analysis.id)}
                      className={cn(
                        "p-4 border rounded-lg text-left transition-colors",
                        settings.analysisType === analysis.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{analysis.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {analysis.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Measurement Types */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Measurement Types</h3>
              <div className="space-y-3">
                {measurementOptions.map((measurement) => (
                  <div
                    key={measurement.id}
                    className="flex items-center space-x-3"
                  >
                    <Checkbox
                      id={measurement.id}
                      checked={settings.measurementTypes.includes(
                        measurement.id
                      )}
                      onChange={() =>
                        handleMeasurementTypeToggle(measurement.id)
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor={measurement.id} className="font-medium">
                        {measurement.name} ({measurement.unit})
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {measurement.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Analysis Parameters */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">
                Analysis Parameters
              </h3>
              {renderParameterInputs()}
            </Card>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <div className="text-sm text-muted-foreground">
              {probes.length} probe(s) • {settings.measurementTypes.length}{" "}
              measurement type(s)
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleRunSimulation}
                disabled={simulationState.isRunning || probes.length === 0}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Run Simulation
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
