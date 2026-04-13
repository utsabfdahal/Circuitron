"use client";

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { useSimulation } from "@/hooks/use-simulation";
import { Loader2 } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register base chart.js components immediately (they're SSR-safe)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Dynamically import zoom plugin only on the client
let zoomPluginRegistered = false;
if (typeof window !== "undefined") {
  import("chartjs-plugin-zoom").then((mod) => {
    if (!zoomPluginRegistered) {
      ChartJS.register(mod.default);
      zoomPluginRegistered = true;
    }
  });
}

interface WaveformViewerProps {
  hiddenProbes?: Set<string>;
  waveforms?: any[]; // Accept waveforms as prop
  isLoading?: boolean; // Add loading state prop
}

export const WaveformViewer = forwardRef<any, WaveformViewerProps>(
  ({ hiddenProbes = new Set(), waveforms: propWaveforms, isLoading = false }, ref) => {
    const { simulationState } = useSimulation();
    const chartRef = useRef<ChartJS<"line">>(null);

    // Use prop waveforms if provided, otherwise use hook state
    const waveforms = propWaveforms || simulationState.waveforms;
    
    // Check if simulation is running or loading
    const isSimulationActive = isLoading || simulationState.isRunning;

    // Debug: Track simulationState changes
    React.useEffect(() => {
      console.log("WaveformViewer: simulationState updated:", {
        hasWaveforms: !!simulationState.waveforms,
        waveformsLength: simulationState.waveforms?.length || 0,
        propWaveformsLength: propWaveforms?.length || 0,
        usingPropWaveforms: !!propWaveforms,
        isRunning: simulationState.isRunning,
        progress: simulationState.progress,
      });
    }, [simulationState, propWaveforms]);

    useImperativeHandle(ref, () => ({
      canvas: chartRef.current?.canvas,
    }));

    const colors = [
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#f9ca24",
      "#6c5ce7",
      "#a0e7e5",
      "#ffeaa7",
      "#fab1a0",
      "#fd79a8",
      "#00b894",
    ];

    const generateChartData = () => {
      console.log("WaveformViewer generateChartData called:", {
        hasWaveforms: !!waveforms,
        waveformsLength: waveforms?.length || 0,
        waveforms: waveforms,
        hiddenProbes: Array.from(hiddenProbes),
        usingPropWaveforms: !!propWaveforms,
      });

      if (!waveforms || waveforms.length === 0) {
        console.log("No waveforms available");
        return {
          labels: [],
          datasets: [],
        };
      }

      // Filter out hidden probes
      const visibleWaveforms = waveforms.filter(
        (waveform: any) => !hiddenProbes.has(waveform.probeId || waveform.name)
      );

      console.log("Visible waveforms after filtering:", {
        originalCount: waveforms.length,
        visibleCount: visibleWaveforms.length,
        visibleWaveforms,
      });

      if (visibleWaveforms.length === 0) {
        console.log("No visible waveforms after filtering");
        return {
          labels: [],
          datasets: [],
        };
      }

      // Use time values from the first visible waveform
      const labels = visibleWaveforms[0].data.map((point: any) => point.x);

      const datasets = visibleWaveforms.map((waveform: any, index: number) => ({
        label: waveform.name || `Probe ${waveform.probeId || index + 1}`,
        data: waveform.data.map((point: any) => point.y),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + "20",
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        pointBackgroundColor: colors[index % colors.length],
        pointBorderColor: "#1a1a1a",
        pointBorderWidth: 2,
        pointHoverBorderWidth: 3,
        spanGaps: true,
      }));

      return { labels, datasets };
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        },
      },
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: "Circuit Simulation Results",
          font: {
            size: 16,
            weight: "bold" as const,
          },
          color: "#ffffff",
        },
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: "#ffffff",
            usePointStyle: true,
            pointStyle: "line",
            font: {
              size: 12,
            },
            padding: 15,
            boxWidth: 15,
            boxHeight: 2,
          },
        },
        tooltip: {
          backgroundColor: "rgba(30, 30, 30, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          borderColor: "#444444",
          borderWidth: 1,
          cornerRadius: 6,
          displayColors: true,
          callbacks: {
            title: (context: any) => {
              const timeValue = parseFloat(context[0].label);
              return `Time: ${timeValue.toExponential(3)}s`;
            },
            label: (context: any) => {
              const value = context.parsed.y;
              return `${context.dataset.label}: ${value.toFixed(3)} V`;
            },
          },
        },
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: "xy" as const,
          },
          pan: {
            enabled: true,
            mode: "xy" as const,
          },
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Time (s)",
            font: {
              size: 14,
              weight: "bold" as const,
            },
            color: "#ffffff",
          },
          grid: {
            display: true,
            color: "rgba(255, 255, 255, 0.1)",
            lineWidth: 1,
          },
          ticks: {
            color: "#cccccc",
            font: {
              size: 11,
            },
            maxTicksLimit: 10,
            callback: function (value: any) {
              // Format time values in scientific notation for small values
              const numValue = parseFloat(value);
              if (numValue < 0.001) {
                return numValue.toExponential(1);
              }
              return numValue.toFixed(3);
            },
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Voltage (V)",
            font: {
              size: 14,
              weight: "bold" as const,
            },
            color: "#ffffff",
          },
          grid: {
            display: true,
            color: "rgba(255, 255, 255, 0.1)",
            lineWidth: 1,
          },
          ticks: {
            color: "#cccccc",
            font: {
              size: 11,
            },
            maxTicksLimit: 8,
            callback: function (value: any) {
              // Format voltage values with appropriate precision
              const numValue = parseFloat(value);
              return numValue.toFixed(2) + "V";
            },
          },
        },
      },
    };

    // Calculate statistics for each visible probe
    const calculateStats = (data: number[]) => {
      if (data.length === 0) return { max: 0, min: 0, range: 0, rms: 0 };

      const max = Math.max(...data);
      const min = Math.min(...data);
      const range = max - min;
      const rms = Math.sqrt(
        data.reduce((sum, val) => sum + val * val, 0) / data.length
      );

      return { max, min, range, rms };
    };

    const chartData = generateChartData();

    const probeStats = chartData.datasets.map((dataset, index) => {
      const stats = calculateStats(dataset.data as number[]);
      return {
        label: dataset.label,
        color: colors[index % colors.length],
        ...stats,
      };
    });

    if (isSimulationActive) {
      return (
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-background/50 to-muted/20 rounded-lg border border-border/20">
          <div className="text-center p-8">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="text-foreground text-lg mb-2 font-medium">
              {isLoading ? "Initializing Simulation..." : "Running Simulation..."}
            </div>
            <div className="text-muted-foreground/80 text-sm mb-3">
              {isLoading 
                ? "Setting up circuit analysis..." 
                : "Processing circuit data..."}
            </div>
            {simulationState.progress > 0 && (
              <div className="w-48 mx-auto">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{simulationState.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${simulationState.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (chartData.datasets.length === 0) {
      return (
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-muted/10 to-muted/30 rounded-lg border border-dashed border-muted-foreground/25">
          <div className="text-center p-8">
            <div className="text-muted-foreground text-lg mb-2 font-medium">
              No simulation data available
            </div>
            <div className="text-muted-foreground/60 text-sm">
              Run a simulation to see the interactive graph
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full bg-gradient-to-br from-background/50 to-muted/20 rounded p-4 flex flex-col">
        <div className="flex-1 min-h-0 bg-gray-900 rounded-lg border border-gray-700 p-3">
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>

        {/* Statistics Panel */}
        {probeStats.length > 0 && (
          <div className="mt-4 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-3">
            <div className="grid grid-cols-5 gap-4 text-xs font-medium text-muted-foreground mb-2">
              <div>Probe</div>
              <div>Max</div>
              <div>Min</div>
              <div>Range</div>
              <div>RMS</div>
            </div>
            {probeStats.map((stat, index) => (
              <div
                key={index}
                className="grid grid-cols-5 gap-4 items-center py-1 text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="font-medium text-foreground">
                    {stat.label}
                  </span>
                </div>
                <div className="text-foreground">{stat.max.toFixed(2)} V</div>
                <div className="text-foreground">{stat.min.toFixed(2)} V</div>
                <div className="text-foreground">{stat.range.toFixed(2)} V</div>
                <div className="text-foreground">{stat.rms.toFixed(2)} V</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

WaveformViewer.displayName = "WaveformViewer";
