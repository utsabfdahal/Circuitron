"use client";

import React, { useState } from "react";
import Draggable from "react-draggable";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSimulation } from "@/hooks/use-simulation";
import { useProbes } from "@/context/probe-context";
import { WaveformViewer } from "./waveform-viewer";

interface DraggableSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DraggableSimulationModal: React.FC<
  DraggableSimulationModalProps
> = ({ isOpen, onClose }) => {
  const { simulationState } = useSimulation();
  const { probes } = useProbes();
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  return (
    <Draggable defaultPosition={{ x: 200, y: 100 }}>
      <Card className="fixed w-[600px] h-[500px] max-h-[90vh] z-50 shadow-2xl flex flex-col bg-white dark:bg-gray-900">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b flex-shrink-0">
          <CardTitle className="text-lg font-semibold">
            Simulation Results
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="flex-1 overflow-y-auto p-4">
            {simulationState.isRunning ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Simulation running... {simulationState.progress}%
                  </p>
                </div>
              </div>
            ) : simulationState.currentSimulation ? (
              <WaveformViewer
                waveforms={simulationState.waveforms}
                isPlaying={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No simulation results yet
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </Draggable>
  );
};

export default DraggableSimulationModal;
