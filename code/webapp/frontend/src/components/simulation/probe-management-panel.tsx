import React, { useState } from "react";
import { Target, Trash2, Eye, EyeOff, Edit3, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProbes } from "@/context/probe-context";

export const ProbeManagementPanel: React.FC = () => {
  const {
    probes,
    removeProbe,
    toggleProbeVisibility,
    clearAllProbes,
    updateProbeLabel,
  } = useProbes();

  const [editingProbeId, setEditingProbeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const handleStartEdit = (probeId: string, currentLabel: string) => {
    setEditingProbeId(probeId);
    setEditingLabel(currentLabel);
  };

  const handleSaveEdit = () => {
    if (editingProbeId && editingLabel.trim()) {
      updateProbeLabel(editingProbeId, editingLabel.trim());
    }
    setEditingProbeId(null);
    setEditingLabel("");
  };

  const handleCancelEdit = () => {
    setEditingProbeId(null);
    setEditingLabel("");
  };

  const visibleProbes = probes.filter((probe) => probe.isVisible);
  const hiddenProbes = probes.filter((probe) => !probe.isVisible);

  if (probes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Probes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No probes placed</div>
            <div className="text-xs mt-1">
              Enable probe mode and click on circuit nodes to add probes
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4" />
            Probes ({probes.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllProbes}
            className="h-6 text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visible Probes */}
        {visibleProbes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Active ({visibleProbes.length})
            </div>
            {visibleProbes.map((probe) => (
              <div
                key={probe.id}
                className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30"
              >
                {/* Probe color indicator */}
                <div
                  className="w-3 h-3 rounded-full border border-background"
                  style={{ backgroundColor: probe.color }}
                />

                {/* Probe label */}
                <div className="flex-1 min-w-0">
                  {editingProbeId === probe.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        className="h-6 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveEdit}
                        className="h-6 w-6 p-0"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {probe.label}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {probe.type}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Probe controls */}
                {editingProbeId !== probe.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(probe.id, probe.label)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleProbeVisibility(probe.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProbe(probe.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden Probes */}
        {hiddenProbes.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Hidden ({hiddenProbes.length})
            </div>
            {hiddenProbes.map((probe) => (
              <div
                key={probe.id}
                className="flex items-center gap-2 p-2 border border-border rounded-md opacity-60"
              >
                {/* Probe color indicator */}
                <div
                  className="w-3 h-3 rounded-full border border-background opacity-50"
                  style={{ backgroundColor: probe.color }}
                />

                {/* Probe label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {probe.label}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {probe.type}
                    </Badge>
                  </div>
                </div>

                {/* Probe controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleProbeVisibility(probe.id)}
                    className="h-6 w-6 p-0"
                  >
                    <EyeOff className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProbe(probe.id)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {probes.length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {visibleProbes.length} active, {hiddenProbes.length} hidden
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
