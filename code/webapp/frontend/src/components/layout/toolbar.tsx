"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useCircuit } from "@/context/circuit-context";
import { ToolType } from "@/types/circuit";
import { cn } from "@/utils";
import {
  MousePointer2,
  Zap,
  Move,
  ZoomIn,
  ZoomOut,
  Type,
  Trash2,
  Copy,
  Scissors,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Target,
  Eraser,
} from "lucide-react";
import { SimulationToolbar } from "@/components/simulation/simulation-toolbar";
import { useProbes } from "@/context/probe-context";

interface ToolbarProps {
  className?: string;
}

export function Toolbar({ className }: ToolbarProps) {
  const { state, dispatch } = useCircuit();
  const { isProbeMode, setProbeMode } = useProbes();

  const tools = [
    {
      id: "select" as ToolType,
      icon: MousePointer2,
      name: "Select",
      shortcut: "V",
    },
    {
      id: "wire" as ToolType,
      icon: Zap,
      name: "Wire",
      shortcut: "W",
    },
    {
      id: "pan" as ToolType,
      icon: Move,
      name: "Pan",
      shortcut: "H",
    },
    {
      id: "text" as ToolType,
      icon: Type,
      name: "Text",
      shortcut: "T",
    },
    {
      id: "eraser" as ToolType,
      icon: Eraser,
      name: "Eraser",
      shortcut: "E",
    },
  ];

  const handleToolSelect = (toolId: ToolType) => {
    dispatch({ type: "SET_TOOL", payload: toolId });
  };

  const handleZoomIn = () => {
    dispatch({
      type: "SET_ZOOM",
      payload: state.viewState.zoom + 0.25,
    });
  };

  const handleZoomOut = () => {
    dispatch({
      type: "SET_ZOOM",
      payload: state.viewState.zoom - 0.25,
    });
  };

  const handleDelete = () => {
    state.viewState.selectedComponents.forEach((id) => {
      dispatch({ type: "DELETE_COMPONENT", payload: id });
    });
  };

  const handleCopy = () => {
    // Feature not implemented yet
    // TODO: Implement copy functionality in future version
  };

  const handleCut = () => {
    // Feature not implemented yet
    // TODO: Implement cut functionality in future version
  };

  const handleRotate = () => {
    // Feature not implemented yet
    // TODO: Implement rotate functionality in future version
  };

  const handleFlipHorizontal = () => {
    // Feature not implemented yet
    // TODO: Implement horizontal flip functionality in future version
  };

  const handleFlipVertical = () => {
    // Feature not implemented yet
    // TODO: Implement vertical flip functionality in future version
  };

  const hasSelection = state.viewState.selectedComponents.length > 0;

  return (
    <div className={cn("bg-background border-b border-border", className)}>
      <div className="flex items-center justify-between p-2">
        {/* Left: Drawing Tools */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const tooltipText =
              tool.id === "wire"
                ? "Wire Tool (W) - Click on two component terminals to create a wire"
                : `${tool.name} (${tool.shortcut})${
                    state.viewState.selectedTool === tool.id &&
                    tool.id !== "select"
                      ? " • Press ESC to exit"
                      : ""
                  }`;
            return (
              <Tooltip key={tool.id} content={tooltipText} side="bottom">
                <Button
                  variant={
                    state.viewState.selectedTool === tool.id
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() => handleToolSelect(tool.id)}
                  className="relative"
                >
                  <Icon className="h-4 w-4" />
                  <span className="sr-only">{tool.name}</span>
                </Button>
              </Tooltip>
            );
          })}

          <div className="w-px h-6 bg-border mx-2" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Tooltip content="Zoom Out (-)" side="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={state.viewState.zoom <= 0.25}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </Tooltip>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {Math.round(state.viewState.zoom * 100)}%
            </span>
            <Tooltip content="Zoom In (+)" side="bottom">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={state.viewState.zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>

          <div className="w-px h-6 bg-border mx-2" />

          {/* Probe Mode Toggle */}
          <Tooltip
            content={`Probe Mode (P) - ${isProbeMode ? "ON" : "OFF"}`}
            side="bottom"
          >
            <Button
              variant={isProbeMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setProbeMode(!isProbeMode)}
              className={isProbeMode ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Target className="h-4 w-4" />
              <span className="sr-only">Probe Mode</span>
            </Button>
          </Tooltip>
        </div>

        {/* Right: Edit Tools */}
        <div className="flex items-center gap-1">
          <Tooltip content="Copy (Ctrl+C) - Coming Soon" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={true}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Cut (Ctrl+X) - Coming Soon" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCut}
              disabled={true}
            >
              <Scissors className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Delete (Del)" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={!hasSelection}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-2" />

          <Tooltip content="Rotate (R) - Coming Soon" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              disabled={true}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Flip Horizontal - Coming Soon" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFlipHorizontal}
              disabled={true}
            >
              <FlipHorizontal className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Flip Vertical - Coming Soon" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFlipVertical}
              disabled={true}
            >
              <FlipVertical className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        {/* Simulation Controls */}
        <div className="flex items-center">
          <div className="w-px h-6 bg-border mx-2" />
          <SimulationToolbar />
        </div>
      </div>
    </div>
  );
}
