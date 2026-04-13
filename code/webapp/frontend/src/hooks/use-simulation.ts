import { useState, useCallback, useRef, useEffect } from "react";
import { useCircuit } from "@/context/circuit-context";
import { useProbes, Probe } from "@/context/probe-context";
import { useToast } from "@/hooks/use-toast";
import {
  simulationAPI,
  SimulationRequest,
  SimulationResult,
  WaveformData,
} from "@/services/simulation-api";

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

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  progress: number;
  currentSimulation: SimulationResult | null;
  waveforms: WaveformData[];
  error: string | null;
  playbackSpeed: number;
  currentTime: number;
  currentSettings: SimulationSettings | null;
}

export const useSimulation = () => {
  const { state } = useCircuit();
  const { probes } = useProbes();
  const { toast } = useToast();
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    progress: 0,
    currentSimulation: null,
    waveforms: [],
    error: null,
    playbackSpeed: 1,
    currentTime: 0,
    currentSettings: null,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Generate dummy simulation data for demo purposes
   */
  const generateDummySimulationData = useCallback(
    (
      analysisType: "dc" | "ac" | "transient" = "transient",
      probes: any[],
      parameters: any = {}
    ): WaveformData[] => {
      const dummyWaveforms: WaveformData[] = [];

      if (analysisType === "transient") {
        const timePoints = 200;
        const startTime = parameters.startTime || 0;
        const endTime = parameters.endTime || 1;
        const dt = (endTime - startTime) / timePoints;

        probes.forEach((probe, index) => {
          const data: { x: number; y: number }[] = [];

          for (let i = 0; i <= timePoints; i++) {
            const t = startTime + i * dt;
            let value = 0;

            if (probe.type === "voltage") {
              // Generate realistic voltage waveforms
              switch (index % 4) {
                case 0: // Sine wave
                  value = 5 * Math.sin(2 * Math.PI * 1 * t) + 2.5;
                  break;
                case 1: // Square wave
                  value = t % 0.5 < 0.25 ? 5 : 0;
                  break;
                case 2: // Exponential decay
                  value = 5 * Math.exp(-t * 2);
                  break;
                case 3: // Triangular wave
                  const period = 0.5;
                  const phase = (t % period) / period;
                  value = phase < 0.5 ? 5 * phase * 2 : 5 * (2 - phase * 2);
                  break;
              }
            } else if (probe.type === "current") {
              // Generate current waveforms (typically smaller values)
              switch (index % 3) {
                case 0: // Current following voltage
                  value = 0.001 * Math.sin(2 * Math.PI * 1 * t + Math.PI / 4);
                  break;
                case 1: // Exponential current
                  value = 0.002 * (1 - Math.exp(-t * 3));
                  break;
                case 2: // Oscillating current
                  value =
                    0.0015 * Math.sin(2 * Math.PI * 2 * t) * Math.exp(-t * 0.5);
                  break;
              }
            } else if (probe.type === "power") {
              // Generate power waveforms (voltage * current)
              switch (index % 3) {
                case 0: // Power from sine voltage and current
                  const voltage = 5 * Math.sin(2 * Math.PI * 1 * t) + 2.5;
                  const current =
                    0.001 * Math.sin(2 * Math.PI * 1 * t + Math.PI / 4);
                  value = Math.abs(voltage * current);
                  break;
                case 1: // Exponential power decay
                  value = 0.01 * Math.exp(-t * 1.5);
                  break;
                case 2: // Oscillating power
                  value =
                    0.005 *
                    Math.abs(Math.sin(2 * Math.PI * 1.5 * t)) *
                    Math.exp(-t * 0.3);
                  break;
              }
            }

            data.push({ x: t, y: value });
          }

          dummyWaveforms.push({
            name:
              probe.label ||
              `${probe.type === "voltage" ? "V" : "I"}(${
                probe.nodeId || probe.componentId
              })`,
            data,
            unit: probe.type === "voltage" ? "V" : "A",
            color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
            type: probe.type,
            probeId: probe.id,
          });
        });
      }

      return dummyWaveforms;
    },
    []
  );

  /**
   * Start a new simulation - requires probes to be placed
   */
  const startSimulation = useCallback(
    async (
      analysisType: "dc" | "ac" | "transient" = "transient",
      parameters: any = {}
    ) => {
      try {
        // Get visible probes for simulation
        const visibleProbes = probes.filter((probe) => probe.isVisible);

        setSimulationState((prev) => ({
          ...prev,
          isRunning: true,
          isPaused: false,
          progress: 0,
          error: null,
          currentTime: 0,
        }));

        // Simulate progress for demo
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 20;
          setSimulationState((prev) => ({
            ...prev,
            progress,
          }));

          if (progress >= 100) {
            clearInterval(progressInterval);

            // Generate dummy waveforms
            const dummyWaveforms = generateDummySimulationData(
              analysisType,
              visibleProbes,
              parameters
            );

            // Complete simulation with dummy data
            setSimulationState((prev) => ({
              ...prev,
              isRunning: false,
              waveforms: dummyWaveforms,
              progress: 100,
              currentSimulation: {
                id: `sim_${Date.now()}`,
                status: "completed",
                progress: 100,
                data: {
                  time: dummyWaveforms[0]?.data.map((d) => d.x) || [],
                  voltage: {},
                  current: {},
                },
                metadata: {
                  analysisType,
                  duration: 1,
                  nodes: [],
                  components: [],
                },
              },
            }));
          }
        }, 500);

        /* 
        // Original API call - commented out for dummy data demo
        const request: SimulationRequest = {
          circuit: {
            components: state.circuit.components,
            wires: state.circuit.wires,
            textElements: state.circuit.textElements,
          },
          analysisType,
          parameters: {
            startTime: 0,
            endTime: 1,
            timeStep: 0.01,
            ...parameters,
          },
          // Include probe information for targeted simulation
          probes: visibleProbes.map((probe) => ({
            id: probe.id,
            type: probe.type,
            nodeId: probe.nodeId,
            componentId: probe.componentId,
            label: probe.label,
            position: probe.position,
          })),
        };

        // Start simulation
        const result = await simulationAPI.startSimulation(request);

        setSimulationState((prev) => ({
          ...prev,
          currentSimulation: result,
        }));

        // Start polling for results
        startPolling(result.id);
        */
      } catch (error) {
        setSimulationState((prev) => ({
          ...prev,
          isRunning: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
        toast.error(
          "Simulation failed: " +
            (error instanceof Error ? error.message : "Unknown error")
        );
      }
    },
    [state.circuit]
  );

  /**
   * Stop current simulation
   */
  const stopSimulation = useCallback(async () => {
    if (simulationState.currentSimulation) {
      try {
        await simulationAPI.stopSimulation(
          simulationState.currentSimulation.id
        );
      } catch (error) {
        console.error("Failed to stop simulation:", error);
      }
    }

    stopPolling();
    stopPlayback();

    setSimulationState((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      progress: 0,
      currentTime: 0,
    }));
  }, [simulationState.currentSimulation]);

  /**
   * Pause/Resume playback
   */
  const togglePlayback = useCallback(() => {
    if (simulationState.isPaused) {
      startPlayback();
    } else {
      stopPlayback();
    }

    setSimulationState((prev) => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  }, [simulationState.isPaused]);

  /**
   * Set playback speed
   */
  const setPlaybackSpeed = useCallback(
    (speed: number) => {
      setSimulationState((prev) => ({
        ...prev,
        playbackSpeed: Math.max(0.1, Math.min(10, speed)),
      }));

      // Restart playback with new speed if currently playing
      if (
        !simulationState.isPaused &&
        simulationState.currentSimulation?.status === "completed"
      ) {
        stopPlayback();
        startPlayback();
      }
    },
    [simulationState.isPaused, simulationState.currentSimulation]
  );

  /**
   * Set current playback time
   */
  const setCurrentTime = useCallback(
    (time: number) => {
      const maxTime =
        simulationState.waveforms[0]?.data[
          simulationState.waveforms[0].data.length - 1
        ]?.x || 1;
      setSimulationState((prev) => ({
        ...prev,
        currentTime: Math.max(0, Math.min(maxTime, time)),
      }));
    },
    [simulationState.waveforms]
  );

  /**
   * Download simulation results
   */
  const downloadResults = useCallback(
    async (format: "csv" | "json" | "png") => {
      if (!simulationState.currentSimulation) return;

      try {
        const blob = await simulationAPI.downloadResults(
          simulationState.currentSimulation.id,
          format
        );

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `simulation_results.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        setSimulationState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Download failed",
        }));
      }
    },
    [simulationState.currentSimulation]
  );

  /**
   * Download generated netlist
   */
  const downloadNetlist = useCallback(async () => {
    if (!simulationState.currentSimulation) return;

    try {
      const netlist = await simulationAPI.downloadNetlist(
        simulationState.currentSimulation.id
      );

      // Create download link
      const blob = new Blob([netlist], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "circuit.net";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setSimulationState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Download failed",
      }));
    }
  }, [simulationState.currentSimulation]);

  /**
   * Start polling for simulation results
   */
  const startPolling = (simulationId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await simulationAPI.getSimulationResult(simulationId);

        setSimulationState((prev) => ({
          ...prev,
          currentSimulation: result,
          progress: result.progress,
        }));

        if (result.status === "completed") {
          // Convert results to waveforms, filtered by probes
          const visibleProbes = probes.filter((probe) => probe.isVisible);
          const waveforms = simulationAPI.convertToWaveforms(
            result,
            visibleProbes
          );

          console.log("Polling: Setting waveforms in simulationState:", {
            waveformsCount: waveforms.length,
            waveforms,
            visibleProbesCount: visibleProbes.length,
            allProbesCount: probes.length,
          });

          setSimulationState((prev) => ({
            ...prev,
            isRunning: false,
            waveforms,
            progress: 100,
          }));

          console.log(
            "Polling: State update called, stopping polling and starting playback"
          );
          stopPolling();
          startPlayback();
        } else if (result.status === "error") {
          setSimulationState((prev) => ({
            ...prev,
            isRunning: false,
            error: result.error || "Simulation failed",
          }));
          stopPolling();
        }
      } catch (error) {
        setSimulationState((prev) => ({
          ...prev,
          isRunning: false,
          error: error instanceof Error ? error.message : "Polling failed",
        }));
        stopPolling();
      }
    }, 1000); // Poll every second
  };

  /**
   * Stop polling
   */
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  /**
   * Start waveform playback animation
   */
  const startPlayback = () => {
    if (simulationState.waveforms.length === 0) return;

    const maxTime =
      simulationState.waveforms[0]?.data[
        simulationState.waveforms[0].data.length - 1
      ]?.x || 1;
    const timeStep = maxTime / 1000; // 1000 steps for smooth animation

    playbackIntervalRef.current = setInterval(() => {
      setSimulationState((prev) => {
        const nextTime = prev.currentTime + timeStep * prev.playbackSpeed;
        if (nextTime >= maxTime) {
          stopPlayback();
          return { ...prev, currentTime: maxTime, isPaused: true };
        }
        return { ...prev, currentTime: nextTime };
      });
    }, 16); // ~60fps
  };

  /**
   * Stop waveform playback
   */
  const stopPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  /**
   * Run simulation with enhanced settings
   */
  const runSimulationWithSettings = useCallback(
    async (settings: SimulationSettings) => {
      try {
        // Get visible probes for simulation
        let visibleProbes = probes.filter((probe) => probe.isVisible);

        // If no probes, create default probes for all nodes in the circuit
        if (visibleProbes.length === 0) {
          console.log("No probes placed, creating default probes for all circuit nodes");
          
          // Create default probes for common nodes (0, 1, 2, etc.)
          // These will be matched to actual simulation output
          const defaultProbes: Probe[] = [
            { id: "default-v1", type: "voltage" as const, nodeId: "1", label: "V(1)", position: { x: 100, y: 100 }, color: "#ff0000", isVisible: true },
            { id: "default-v2", type: "voltage" as const, nodeId: "2", label: "V(2)", position: { x: 150, y: 100 }, color: "#0000ff", isVisible: true },
          ];
          
          visibleProbes = defaultProbes;
          console.log("Created default probes:", visibleProbes);
        }

        setSimulationState((prev) => ({
          ...prev,
          isRunning: true,
          isPaused: false,
          progress: 0,
          error: null,
          currentTime: 0,
          currentSettings: settings,
        }));

        // Show starting simulation toast
        toast.success(
          `Running ${settings.analysisType} analysis with ${settings.measurementTypes.length} measurement type(s)`
        );

        // Create simulation request
        const request: SimulationRequest = {
          circuit: {
            components: state.circuit.components,
            wires: state.circuit.wires,
            textElements: state.circuit.textElements,
          },
          analysisType: settings.analysisType,
          measurementTypes: settings.measurementTypes,
          parameters: settings.parameters,
          probes: visibleProbes.map((probe) => ({
            id: probe.id,
            type: probe.type,
            nodeId: probe.nodeId,
            componentId: probe.componentId,
            label: probe.label,
            position: probe.position,
          })),
        };

        console.log("Starting simulation with request:", request);

        // Start simulation with backend
        const result = await simulationAPI.startSimulation(request);

        setSimulationState((prev) => ({
          ...prev,
          currentSimulation: result,
        }));

        // If simulation completed immediately, process results
        if (result.status === "completed") {
          const waveforms = simulationAPI.convertToWaveforms(
            result,
            visibleProbes
          );

          console.log("Setting waveforms in simulationState:", {
            waveformsCount: waveforms.length,
            waveforms,
            visibleProbesCount: visibleProbes.length,
          });

          setSimulationState((prev) => ({
            ...prev,
            isRunning: false,
            waveforms,
            progress: 100,
          }));

          console.log("State update called, starting playback");

          // Debug: Check state immediately after update
          setTimeout(() => {
            console.log("useSimulation: State after update:", {
              waveformsLength: waveforms.length,
              stateRef: simulationState,
            });
          }, 100);

          startPlayback();
          toast.success(
            `${settings.analysisType} analysis finished successfully`
          );
        } else {
          // Start polling for results if still running
          startPolling(result.id);
        }
      } catch (error) {
        setSimulationState((prev) => ({
          ...prev,
          isRunning: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
        toast.error(error instanceof Error ? error.message : "Unknown error");
      }
    },
    [probes, state.circuit, toast]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      stopPlayback();
    };
  }, []);

  return {
    simulationState,
    startSimulation,
    runSimulationWithSettings,
    stopSimulation,
    togglePlayback,
    setPlaybackSpeed,
    setCurrentTime,
    downloadResults,
    downloadNetlist,
  };
};
