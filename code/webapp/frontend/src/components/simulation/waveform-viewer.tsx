"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Download,
  Maximize2,
  Play,
  Pause,
  Square
} from "lucide-react";
import { WaveformData } from "@/services/simulation-api";

// Chart.js imports with zoom plugin
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  InteractionItem,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register base chart.js components (SSR-safe)
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
  waveforms?: WaveformData[];
  currentTime?: number;
  onTimeChange?: (time: number) => void;
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  hiddenProbes?: Set<string>;
}

interface ViewSettings {
  showGrid: boolean;
  showLegend: boolean;
  showCrosshair: boolean;
  autoScale: boolean;
  visibleWaveforms: Set<string>;
  zoom: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
  cursorPosition: { x: number; y: number } | null;
}

export const WaveformViewer: React.FC<WaveformViewerProps> = ({
  waveforms = [],
  currentTime = 0,
  onTimeChange,
  isPlaying = false,
  onPlayStateChange,
}) => {
  const chartRef = useRef<ChartJS<"line">>(null);
  const [viewSettings, setViewSettings] = useState<ViewSettings>({
    showGrid: true,
    showLegend: true,
    showCrosshair: true,
    autoScale: true,
    visibleWaveforms: new Set((waveforms || []).map((w) => w.name)),
    zoom: null,
    cursorPosition: null,
  });

  // Update visible waveforms when waveforms prop changes
  useEffect(() => {
    setViewSettings((prev) => ({
      ...prev,
      visibleWaveforms: new Set(waveforms.map((w) => w.name)),
    }));
  }, [waveforms]);

  const toggleWaveformVisibility = (waveformName: string) => {
    setViewSettings((prev) => {
      const newVisible = new Set(prev.visibleWaveforms);
      if (newVisible.has(waveformName)) {
        newVisible.delete(waveformName);
      } else {
        newVisible.add(waveformName);
      }
      return { ...prev, visibleWaveforms: newVisible };
    });
  };

  const resetZoom = () => {
    setViewSettings((prev) => ({ 
      ...prev, 
      zoom: null, 
      autoScale: true 
    }));
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const autoScale = () => {
    setViewSettings((prev) => ({ 
      ...prev, 
      autoScale: true,
      zoom: null 
    }));
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const downloadChart = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = 'waveform.png';
      link.href = url;
      link.click();
    }
  };

  const exportData = () => {
    const csvData = waveforms
      .filter(w => viewSettings.visibleWaveforms.has(w.name))
      .map(waveform => {
        const header = `Time,${waveform.name}`;
        const rows = waveform.data.map(point => `${point.x},${point.y}`);
        return [header, ...rows].join('\n');
      })
      .join('\n\n');
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'waveform_data.csv';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Time slider for playback control
  const allTimeValues = waveforms.flatMap(w => w.data.map(d => d.x));
  const maxTime = allTimeValues.length > 0 ? Math.max(...allTimeValues) : 1;
  const minTime = allTimeValues.length > 0 ? Math.min(...allTimeValues) : 0;

  const getWaveformColor = (index: number): string => {
    const colors = [
      "#3b82f6", // blue
      "#ef4444", // red
      "#10b981", // green
      "#f59e0b", // yellow
      "#8b5cf6", // purple
      "#06b6d4", // cyan
      "#f97316", // orange
      "#84cc16", // lime
    ];
    return colors[index % colors.length];
  };

  const getUnitFromName = (name: string): string => {
    if (
      name.toLowerCase().includes("voltage") ||
      name.toLowerCase().includes("v(")
    ) {
      return "V";
    }
    if (
      name.toLowerCase().includes("current") ||
      name.toLowerCase().includes("i(")
    ) {
      return "A";
    }
    if (name.toLowerCase().includes("power")) {
      return "W";
    }
    return "";
  };

  const formatValue = (value: number, unit: string): string => {
    if (Math.abs(value) >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M${unit}`;
    }
    if (Math.abs(value) >= 1e3) {
      return `${(value / 1e3).toFixed(2)}k${unit}`;
    }
    if (Math.abs(value) >= 1) {
      return `${value.toFixed(3)}${unit}`;
    }
    if (Math.abs(value) >= 1e-3) {
      return `${(value * 1e3).toFixed(2)}m${unit}`;
    }
    if (Math.abs(value) >= 1e-6) {
      return `${(value * 1e6).toFixed(2)}μ${unit}`;
    }
    return `${(value * 1e9).toFixed(2)}n${unit}`;
  };

  // Prepare chart data
  const chartData = {
    datasets: waveforms
      .filter((waveform) => viewSettings.visibleWaveforms.has(waveform.name))
      .map((waveform, index) => ({
        label: waveform.name,
        data: waveform.data.map((point) => ({ x: point.x, y: point.y })),
        borderColor: getWaveformColor(index),
        backgroundColor: getWaveformColor(index) + "20",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
      })),
  };

  // Chart options with enhanced interactivity
  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    onHover: (event, elements) => {
      if (event.native && chartRef.current) {
        const chart = chartRef.current;
        const canvasPosition = chart.canvas.getBoundingClientRect();
        const mouseEvent = event.native as MouseEvent;
        const x = mouseEvent.clientX - canvasPosition.left;
        const y = mouseEvent.clientY - canvasPosition.top;
        
        setViewSettings(prev => ({
          ...prev,
          cursorPosition: { x, y }
        }));
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onTimeChange) {
        const element = elements[0];
        const dataIndex = element.index;
        const dataset = chartRef.current?.data.datasets[element.datasetIndex];
        if (dataset && dataset.data[dataIndex]) {
          const point = dataset.data[dataIndex] as { x: number; y: number };
          onTimeChange(point.x);
        }
      }
    },
    plugins: {
      legend: {
        display: viewSettings.showLegend,
        position: "top",
        onClick: (event, legendItem, legend) => {
          const chart = legend.chart;
          const datasetIndex = legendItem.datasetIndex!;
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.hidden = !meta.hidden;
          chart.update();
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (context: any[]) => {
            const time = context[0]?.parsed?.x || 0;
            if (time < 1e-6) return `${(time * 1e9).toFixed(2)} ns`;
            if (time < 1e-3) return `${(time * 1e6).toFixed(2)} μs`;
            if (time < 1) return `${(time * 1e3).toFixed(2)} ms`;
            return `${time.toFixed(3)} s`;
          },
          label: (context: any) => {
            const waveformName = context.dataset.label || "";
            const value = context.parsed.y;
            const unit = getUnitFromName(waveformName);
            return `${waveformName}: ${formatValue(value, unit)}`;
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
          mode: 'xy',
          onZoomComplete: ({ chart }) => {
            const { min: xMin, max: xMax } = chart.scales.x;
            const { min: yMin, max: yMax } = chart.scales.y;
            setViewSettings(prev => ({
              ...prev,
              zoom: { xMin, xMax, yMin, yMax },
              autoScale: false,
            }));
          },
        },
        pan: {
          enabled: true,
          mode: 'xy',
          onPanComplete: ({ chart }) => {
            const { min: xMin, max: xMax } = chart.scales.x;
            const { min: yMin, max: yMax } = chart.scales.y;
            setViewSettings(prev => ({
              ...prev,
              zoom: { xMin, xMax, yMin, yMax },
              autoScale: false,
            }));
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        display: true,
        title: {
          display: true,
          text: "Time (s)",
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        grid: {
          display: viewSettings.showGrid,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            const time = Number(value);
            if (time < 1e-6) return `${(time * 1e9).toFixed(1)}n`;
            if (time < 1e-3) return `${(time * 1e6).toFixed(1)}μ`;
            if (time < 1) return `${(time * 1e3).toFixed(1)}m`;
            return `${time.toFixed(3)}`;
          },
        },
        ...(viewSettings.zoom && !viewSettings.autoScale && {
          min: viewSettings.zoom.xMin,
          max: viewSettings.zoom.xMax,
        }),
      },
      y: {
        display: true,
        title: {
          display: true,
          text: "Amplitude",
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        grid: {
          display: viewSettings.showGrid,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: function(value: any) {
            const num = Number(value);
            if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
            if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}k`;
            if (Math.abs(num) >= 1) return `${num.toFixed(2)}`;
            if (Math.abs(num) >= 1e-3) return `${(num * 1e3).toFixed(1)}m`;
            if (Math.abs(num) >= 1e-6) return `${(num * 1e6).toFixed(1)}μ`;
            return `${(num * 1e9).toFixed(1)}n`;
          },
        },
        ...(viewSettings.zoom && !viewSettings.autoScale && {
          min: viewSettings.zoom.yMin,
          max: viewSettings.zoom.yMax,
        }),
      },
    },
    animation: {
      duration: 0, // Disable animation for better performance
    },
  };

  // Add current time indicator line
  if (currentTime > 0) {
    const timeLinePlugin = {
      id: "timeIndicator",
      beforeDraw: (chart: ChartJS) => {
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;

        if (xScale && yScale) {
          const x = xScale.getPixelForValue(currentTime);

          ctx.save();
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.stroke();
          ctx.restore();
        }
      },
    };

    ChartJS.register(timeLinePlugin);
  }

  if (waveforms.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">No Waveform Data</div>
            <div className="text-sm">Run a simulation to see results here</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Enhanced Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Interactive Waveform Viewer</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setViewSettings((prev) => ({
                    ...prev,
                    showGrid: !prev.showGrid,
                  }))
                }
                className={viewSettings.showGrid ? "bg-primary/10" : ""}
              >
                Grid
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setViewSettings((prev) => ({
                    ...prev,
                    showLegend: !prev.showLegend,
                  }))
                }
                className={viewSettings.showLegend ? "bg-primary/10" : ""}
              >
                Legend
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setViewSettings((prev) => ({
                    ...prev,
                    showCrosshair: !prev.showCrosshair,
                  }))
                }
                className={viewSettings.showCrosshair ? "bg-primary/10" : ""}
              >
                Crosshair
              </Button>
              <Button size="sm" variant="outline" onClick={autoScale}>
                <Maximize2 className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={resetZoom}>
                <RotateCcw className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={downloadChart}>
                <Download className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Waveform List */}
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {waveforms.map((waveform, index) => (
                <div key={waveform.name} className="flex items-center gap-2">
                  <Checkbox
                    checked={viewSettings.visibleWaveforms.has(waveform.name)}
                    onCheckedChange={() =>
                      toggleWaveformVisibility(waveform.name)
                    }
                  />
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getWaveformColor(index) }}
                  />
                  <span className="text-sm flex-1">{waveform.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {getUnitFromName(waveform.name)}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Playback Controls */}
            {onTimeChange && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Playback Control</span>
                  <div className="flex items-center gap-1">
                    {onPlayStateChange && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPlayStateChange(!isPlaying)}
                      >
                        {isPlaying ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTimeChange(minTime)}
                    >
                      <Square className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Slider
                    value={[currentTime]}
                    onValueChange={([value]) => onTimeChange(value)}
                    min={minTime}
                    max={maxTime}
                    step={(maxTime - minTime) / 1000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {minTime < 1e-6
                        ? `${(minTime * 1e9).toFixed(1)} ns`
                        : minTime < 1e-3
                        ? `${(minTime * 1e6).toFixed(1)} μs`
                        : minTime < 1
                        ? `${(minTime * 1e3).toFixed(1)} ms`
                        : `${minTime.toFixed(3)} s`}
                    </span>
                    <span className="font-medium">
                      Current: {
                        currentTime < 1e-6
                          ? `${(currentTime * 1e9).toFixed(1)} ns`
                          : currentTime < 1e-3
                          ? `${(currentTime * 1e6).toFixed(1)} μs`
                          : currentTime < 1
                          ? `${(currentTime * 1e3).toFixed(1)} ms`
                          : `${currentTime.toFixed(3)} s`
                      }
                    </span>
                    <span>
                      {maxTime < 1e-6
                        ? `${(maxTime * 1e9).toFixed(1)} ns`
                        : maxTime < 1e-3
                        ? `${(maxTime * 1e6).toFixed(1)} μs`
                        : maxTime < 1
                        ? `${(maxTime * 1e3).toFixed(1)} ms`
                        : `${maxTime.toFixed(3)} s`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Export Options */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportData}>
                Export CSV
              </Button>
              <span className="text-xs text-muted-foreground">
                Zoom: Mouse wheel | Pan: Click & drag | Click point to jump to time
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Chart */}
      <Card className="flex-1 min-h-0">
        <CardContent className="p-4 h-full">
          <div className="h-full w-full relative">
            <Line ref={chartRef} data={chartData} options={chartOptions} />
            {viewSettings.showCrosshair && viewSettings.cursorPosition && (
              <div
                className="absolute pointer-events-none border-l border-t border-red-500 opacity-50"
                style={{
                  left: viewSettings.cursorPosition.x,
                  top: viewSettings.cursorPosition.y,
                  width: '1px',
                  height: '1px',
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Values */}
      {currentTime > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Current Values @{" "}
              {currentTime < 1e-6
                ? `${(currentTime * 1e9).toFixed(2)} ns`
                : currentTime < 1e-3
                ? `${(currentTime * 1e6).toFixed(2)} μs`
                : currentTime < 1
                ? `${(currentTime * 1e3).toFixed(2)} ms`
                : `${currentTime.toFixed(3)} s`}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-2 text-sm">
              {waveforms
                .filter((waveform) =>
                  viewSettings.visibleWaveforms.has(waveform.name)
                )
                .map((waveform, index) => {
                  // Find closest data point to current time
                  const closestPoint = waveform.data.reduce((prev, curr) =>
                    Math.abs(curr.x - currentTime) <
                    Math.abs(prev.x - currentTime)
                      ? curr
                      : prev
                  );

                  const unit = getUnitFromName(waveform.name);

                  return (
                    <div
                      key={waveform.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded"
                          style={{ backgroundColor: getWaveformColor(index) }}
                        />
                        <span>{waveform.name}</span>
                      </div>
                      <span className="font-mono">
                        {formatValue(closestPoint.y, unit)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
