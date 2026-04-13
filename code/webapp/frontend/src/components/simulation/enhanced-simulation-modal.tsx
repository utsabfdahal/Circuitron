"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { WaveformViewer } from "./modal-waveform-viewer";
import { useProbes } from "@/context/probe-context";
import { useSimulation } from "@/hooks/use-simulation";
import { useCircuit } from "@/context/circuit-context";
import { useToast } from "@/hooks/use-toast";
import { useSimulationModal } from "@/context/simulation-modal-context";
import { simulationAPI } from "@/services/simulation-api";
import {
  X,
  Play,
  Pause,
  Download,
  Camera,
  Settings,
  Zap,
  TrendingUp,
  Activity,
  Calculator,
  Target,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  FastForward,
  Rewind,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@/utils";

export interface EnhancedSimulationSettings {
  analysisType: "dc" | "ac" | "transient" | "operational";
  measurementTypes: ("voltage" | "current" | "power")[];
  parameters: {
    // Transient Analysis
    startTime?: number;
    stopTime?: number;
    stepSize?: number;
    // DC Analysis
    startVoltage?: number;
    stopVoltage?: number;
    stepVoltage?: number;
    // AC Analysis
    startFreq?: number;
    stopFreq?: number;
    pointsPerDecade?: number;
  };
  selectedProbes: string[];
  simulationSpeed: number;
}

interface EnhancedSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSimulation: (settings: EnhancedSimulationSettings) => void;
}

export const EnhancedSimulationModal: React.FC<
  EnhancedSimulationModalProps
> = ({ isOpen, onClose, onRunSimulation }) => {
  const { probes, removeProbe } = useProbes();
  const { simulationState, runSimulationWithSettings } = useSimulation();
  const { state: circuit } = useCircuit();
  const { toast } = useToast();
  const { setIsModalOpen } = useSimulationModal();
  const chartRef = useRef<any>(null);

  // Loading and simulation state
  const [isLoading, setIsLoading] = useState(false);

  // Update modal state when modal opens/closes
  React.useEffect(() => {
    setIsModalOpen(isOpen);
  }, [isOpen, setIsModalOpen]);

  const [settings, setSettings] = useState<EnhancedSimulationSettings>({
    analysisType: "transient",
    measurementTypes: ["voltage"],
    parameters: {
      startTime: 0,
      stopTime: 10e-3,
      stepSize: 1e-6,
      startVoltage: 0,
      stopVoltage: 5,
      stepVoltage: 0.1,
      startFreq: 1,
      stopFreq: 1e6,
      pointsPerDecade: 10,
    },
    selectedProbes: probes.map((p) => p.id),
    simulationSpeed: 1,
  });

  const [hiddenProbes, setHiddenProbes] = useState<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);

  if (!isOpen) return null;

  const handleAnalysisTypeChange = (type: string) => {
    setSettings((prev) => ({ ...prev, analysisType: type as any }));
  };

  const handleMeasurementTypeChange = (type: string, checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      measurementTypes: checked
        ? [...prev.measurementTypes, type as any]
        : prev.measurementTypes.filter((t) => t !== type),
    }));
  };

  const handleParameterChange = (param: string, value: number) => {
    setSettings((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, [param]: value },
    }));
  };

  const handleProbeToggle = (probeId: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedProbes: prev.selectedProbes.includes(probeId)
        ? prev.selectedProbes.filter((id) => id !== probeId)
        : [...prev.selectedProbes, probeId],
    }));
  };

  const handleProbeVisibilityToggle = (probeId: string) => {
    setHiddenProbes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(probeId)) {
        newSet.delete(probeId);
      } else {
        newSet.add(probeId);
      }
      return newSet;
    });
  };

  const handleProbeRemove = (probeId: string) => {
    removeProbe(probeId);
    setSettings((prev) => ({
      ...prev,
      selectedProbes: prev.selectedProbes.filter((id) => id !== probeId),
    }));
    setHiddenProbes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(probeId);
      return newSet;
    });
  };

  const handleRunSimulation = async () => {
    console.log("handleRunSimulation called with:", {
      selectedProbes: settings.selectedProbes,
      allProbes: probes,
      simulationSettings: settings,
    });

    // Allow simulation to run even without explicit probes - default probes will be created
    // if (settings.selectedProbes.length === 0) {
    //   toast.error("Please select at least one probe for simulation.");
    //   return;
    // }

    try {
      setIsLoading(true);

      // Convert settings to the format expected by useSimulation
      const simulationSettings = {
        analysisType: settings.analysisType,
        measurementTypes: settings.measurementTypes,
        parameters: {
          startTime: settings.parameters.startTime,
          endTime: settings.parameters.stopTime,
          timeStep: settings.parameters.stepSize,
          startFreq: settings.parameters.startFreq,
          endFreq: settings.parameters.stopFreq,
          freqStep: settings.parameters.pointsPerDecade,
          startVoltage: settings.parameters.startVoltage,
          endVoltage: settings.parameters.stopVoltage,
          voltageStep: settings.parameters.stepVoltage,
          temperature: 27, // Default temperature
        },
      };

      console.log("Starting simulation with settings:", simulationSettings);
      await runSimulationWithSettings(simulationSettings);
      setIsPlaying(true);
    } catch (error) {
      console.error("Simulation error:", error);
      toast.error(
        `Simulation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!simulationState.waveforms || simulationState.waveforms.length === 0) {
      toast.error("No simulation data to export.");
      return;
    }

    try {
      // Get time data from the first waveform
      const timeData = simulationState.waveforms[0].data.map(
        (point: any) => point.x
      );

      // Create CSV headers
      const headers = [
        "Time (s)",
        ...simulationState.waveforms.map(
          (waveform: any) => `${waveform.name} (${waveform.unit || "V"})`
        ),
      ];

      // Create CSV rows
      const rows = timeData.map((time: number, index: number) => {
        const row = [time.toString()];
        simulationState.waveforms.forEach((waveform: any) => {
          const value = waveform.data[index]?.y || 0;
          row.push(value.toString());
        });
        return row.join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulation-results-${settings.analysisType}-${new Date()
        .toISOString()
        .slice(0, 19)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Simulation data exported to CSV.");
    } catch (error) {
      console.error("CSV export error:", error);
      toast.error("Failed to export CSV data.");
    }
  };

  const handleExportImage = () => {
    if (chartRef.current) {
      const canvas = chartRef.current.canvas;
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulation-graph-${new Date()
        .toISOString()
        .slice(0, 19)}.png`;
      a.click();
      toast.success("Graph exported as image.");
    } else {
      toast.error("No graph available to export.");
    }
  };

  const getAnalysisDescription = (type: string) => {
    switch (type) {
      case "dc":
        return "DC sweep analysis";
      case "ac":
        return "AC frequency analysis";
      case "transient":
        return "Time-domain analysis";
      case "operational":
        return "Operating point analysis";
      default:
        return "Analysis type";
    }
  };

  const getAnalysisIcon = (type: string) => {
    switch (type) {
      case "dc":
        return <Zap className="w-4 h-4" />;
      case "ac":
        return <TrendingUp className="w-4 h-4" />;
      case "transient":
        return <Activity className="w-4 h-4" />;
      case "operational":
        return <Calculator className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div></div> {/* Empty div for spacing */}
          <h1 className="text-2xl font-bold text-foreground">
            Circuit Simulation
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex items-center gap-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Control Navigation Bar */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-4">
            {/* Analysis Type Selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Analysis:</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 min-w-[160px] justify-between hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      {getAnalysisIcon(settings.analysisType)}
                      <span className="capitalize">
                        {settings.analysisType}
                      </span>
                    </div>
                    <ChevronDown className="w-3 h-3 transition-transform duration-150" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[240px] bg-popover/95 backdrop-blur-md border border-border shadow-xl"
                >
                  {["dc", "ac", "transient", "operational"].map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => handleAnalysisTypeChange(type)}
                      className="flex items-center gap-3 p-3 cursor-pointer rounded-md mx-1
                                hover:!bg-slate-100 dark:hover:!bg-slate-800 
                                focus:!bg-slate-100 dark:focus:!bg-slate-800 
                                data-[highlighted]:!bg-slate-100 dark:data-[highlighted]:!bg-slate-800
                                transition-all duration-150"
                    >
                      {/* Dedicated space for check indicator */}
                      <div className="w-4 h-4 flex items-center justify-center">
                        {settings.analysisType === type && (
                          <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-primary-foreground"
                              fill="currentColor"
                              viewBox="0 0 8 8"
                            >
                              <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center bg-muted/60 rounded">
                        {getAnalysisIcon(type)}
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="capitalize font-medium text-foreground text-sm">
                          {type} Analysis
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getAnalysisDescription(type)}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Measurement Types */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Measure:</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 min-w-[140px] justify-between hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 hover:shadow-md"
                  >
                    <span className="text-sm">
                      {settings.measurementTypes.length === 0
                        ? "Select types..."
                        : settings.measurementTypes.length === 1
                        ? `${settings.measurementTypes[0]} (${
                            settings.measurementTypes[0] === "voltage"
                              ? "V"
                              : settings.measurementTypes[0] === "current"
                              ? "A"
                              : "W"
                          })`
                        : `${settings.measurementTypes.length} types selected`}
                    </span>
                    <ChevronDown className="w-3 h-3 transition-transform duration-150" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[220px] bg-popover/95 backdrop-blur-md border border-border shadow-xl"
                >
                  {["voltage", "current", "power"].map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={settings.measurementTypes.includes(type as any)}
                      onCheckedChange={(checked) =>
                        handleMeasurementTypeChange(type, checked as boolean)
                      }
                      className="flex items-center gap-3 p-3 cursor-pointer rounded-md mx-1
                                hover:!bg-slate-100 dark:hover:!bg-slate-800 
                                focus:!bg-slate-100 dark:focus:!bg-slate-800 
                                data-[highlighted]:!bg-slate-100 dark:data-[highlighted]:!bg-slate-800
                                transition-all duration-150
                                [&>span[data-state]]:hidden"
                    >
                      {/* Dedicated space for check indicator */}
                      <div className="w-4 h-4 flex items-center justify-center">
                        {settings.measurementTypes.includes(type as any) && (
                          <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-primary-foreground"
                              fill="currentColor"
                              viewBox="0 0 8 8"
                            >
                              <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 ml-8">
                        <span className="capitalize font-medium text-foreground text-sm">
                          {type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Measure {type} values
                        </span>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {/* Simulation Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={
                  !simulationState.waveforms ||
                  simulationState.waveforms.length === 0
                }
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Rewind className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled>
                <FastForward className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <Label className="text-sm">Speed:</Label>
              <div className="w-20">
                <Slider
                  value={[settings.simulationSpeed]}
                  onValueChange={([value]) =>
                    setSettings((prev) => ({ ...prev, simulationSpeed: value }))
                  }
                  min={0.1}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
              </div>
              <span className="text-xs w-8">{settings.simulationSpeed}x</span>
            </div>

            {/* Export Controls */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={
                  isLoading ||
                  simulationState.isRunning ||
                  !simulationState.waveforms ||
                  simulationState.waveforms.length === 0
                }
              >
                <Download className="w-4 h-4" />
                <span className="ml-1 text-xs">CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportImage}
                disabled={
                  isLoading ||
                  simulationState.isRunning ||
                  !simulationState.waveforms ||
                  simulationState.waveforms.length === 0
                }
              >
                <Camera className="w-4 h-4" />
                <span className="ml-1 text-xs">PNG</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Error Indicator */}
        {simulationState.error && (
          <div className="px-4 py-2 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 text-red-600">
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">
                Error: {simulationState.error}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Probe Management & Parameters */}
          <div className="w-80 border-r border-border p-4 overflow-y-auto bg-muted/20">
            {/* Probe Management */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Probe Management ({probes.length})
              </h3>
              <div className="space-y-2">
                {probes.map((probe) => (
                  <div
                    key={probe.id}
                    className="flex items-center justify-between p-2 bg-muted/60 rounded border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={settings.selectedProbes.includes(probe.id)}
                        onCheckedChange={() => handleProbeToggle(probe.id)}
                      />
                      <span className="text-sm font-medium">
                        {probe.label || `Probe ${probe.id}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProbeVisibilityToggle(probe.id)}
                        className="h-6 w-6 p-0"
                      >
                        {hiddenProbes.has(probe.id) ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProbeRemove(probe.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {probes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No probes placed
                  </p>
                )}
              </div>
            </div>

            {/* Analysis Parameters */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3">
                Analysis Parameters
              </h3>
              <div className="space-y-3 p-3 bg-muted/40 rounded border border-border/50">
                {settings.analysisType === "transient" && (
                  <>
                    <div>
                      <Label className="text-xs">Start Time (s)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.startTime}
                        onChange={(e) =>
                          handleParameterChange(
                            "startTime",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Stop Time (s)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.stopTime}
                        onChange={(e) =>
                          handleParameterChange(
                            "stopTime",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Step Size (s)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.stepSize}
                        onChange={(e) =>
                          handleParameterChange(
                            "stepSize",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </>
                )}
                {settings.analysisType === "dc" && (
                  <>
                    <div>
                      <Label className="text-xs">Start Voltage (V)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.startVoltage}
                        onChange={(e) =>
                          handleParameterChange(
                            "startVoltage",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Stop Voltage (V)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.stopVoltage}
                        onChange={(e) =>
                          handleParameterChange(
                            "stopVoltage",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Step Voltage (V)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.stepVoltage}
                        onChange={(e) =>
                          handleParameterChange(
                            "stepVoltage",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </>
                )}
                {settings.analysisType === "ac" && (
                  <>
                    <div>
                      <Label className="text-xs">Start Frequency (Hz)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.startFreq}
                        onChange={(e) =>
                          handleParameterChange(
                            "startFreq",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Stop Frequency (Hz)</Label>
                      <Input
                        type="number"
                        value={settings.parameters.stopFreq}
                        onChange={(e) =>
                          handleParameterChange(
                            "stopFreq",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Points Per Decade</Label>
                      <Input
                        type="number"
                        value={settings.parameters.pointsPerDecade}
                        onChange={(e) =>
                          handleParameterChange(
                            "pointsPerDecade",
                            Number(e.target.value)
                          )
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Run Simulation Button */}
            <Button
              onClick={handleRunSimulation}
              disabled={
                isLoading ||
                simulationState.isRunning
              }
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Run Simulation
            </Button>
          </div>

          {/* Main Graph Area */}
          <div className="flex-1 p-4 bg-background/50">
            <div className="h-full bg-background/80 rounded border border-border/50 p-2">
              <WaveformViewer
                ref={chartRef}
                hiddenProbes={hiddenProbes}
                waveforms={simulationState.waveforms}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
