import React from "react";
import { Target, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProbes, Probe } from "@/context/probe-context";
import { useSimulationModal } from "@/context/simulation-modal-context";
import { cn } from "@/utils";

interface ProbeOverlayProps {
  // Probe overlay component - click handling is done by canvas
}

export const ProbeOverlay: React.FC<ProbeOverlayProps> = () => {
  const { probes, isProbeMode, removeProbe, toggleProbeVisibility } =
    useProbes();
  const { isModalOpen } = useSimulationModal();

  return (
    <>
      {/* Probe mode overlay - visual feedback only (actual click handling is in canvas) */}
      {isProbeMode && !isModalOpen && (
        <div
          className="absolute inset-0 z-40 cursor-crosshair pointer-events-none"
          style={{
            background: "rgba(59, 130, 246, 0.05)",
            backdropFilter: "blur(0.5px)",
          }}
        />
      )}

      {/* Render individual probes - hide when simulation modal is open */}
      {!isModalOpen &&
        probes.map((probe) => (
          <ProbeMarker
            key={probe.id}
            probe={probe}
            onRemove={() => removeProbe(probe.id)}
            onToggleVisibility={() => toggleProbeVisibility(probe.id)}
          />
        ))}
    </>
  );
};

interface ProbeMarkerProps {
  probe: Probe;
  onRemove: () => void;
  onToggleVisibility: () => void;
}

const ProbeMarker: React.FC<ProbeMarkerProps> = ({
  probe,
  onRemove,
  onToggleVisibility,
}) => {
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: probe.position.x - 12,
        top: probe.position.y - 12,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Probe marker */}
      <div
        className={cn(
          "relative w-6 h-6 rounded-full border-2 shadow-lg transition-all duration-200",
          probe.isVisible
            ? "border-white dark:border-gray-900"
            : "border-gray-400 dark:border-gray-600 opacity-50"
        )}
        style={{
          backgroundColor: probe.isVisible ? probe.color : "#9ca3af",
        }}
      >
        {/* Probe type indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          {probe.type === "voltage" ? (
            <span className="text-xs font-bold text-white">V</span>
          ) : (
            <span className="text-xs font-bold text-white">I</span>
          )}
        </div>

        {/* Pulse animation for active probes */}
        {probe.isVisible && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-75"
            style={{ backgroundColor: probe.color }}
          />
        )}
      </div>

      {/* Probe controls (visible on hover) */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
        <div className="flex items-center gap-1 bg-background border border-border rounded-md shadow-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            className="h-6 w-6 p-0"
          >
            {probe.isVisible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Probe label */}
      <div
        className="absolute top-8 left-1/2 transform -translate-x-1/2 pointer-events-none"
        style={{ minWidth: "60px" }}
      >
        <div className="bg-background/90 border border-border rounded px-2 py-1 shadow-sm">
          <div
            className="text-xs font-medium text-center"
            style={{ color: probe.color }}
          >
            {probe.label}
          </div>
        </div>
      </div>
    </div>
  );
};
