import React, { createContext, useContext, useState, useCallback } from "react";

export interface Probe {
  id: string;
  type: "voltage" | "current" | "power";
  position: { x: number; y: number };
  nodeId?: string;
  componentId?: string;
  label: string;
  color: string;
  isVisible: boolean;
}

interface ProbeContextType {
  probes: Probe[];
  isProbeMode: boolean;
  addProbe: (probe: Omit<Probe, "id" | "color">) => void;
  removeProbe: (probeId: string) => void;
  toggleProbeVisibility: (probeId: string) => void;
  setProbeMode: (enabled: boolean) => void;
  clearAllProbes: () => void;
  updateProbeLabel: (probeId: string, label: string) => void;
  updateProbeType: (
    probeId: string,
    type: "voltage" | "current" | "power"
  ) => void;
  getProbesByType: (type: "voltage" | "current" | "power") => Probe[];
}

const ProbeContext = createContext<ProbeContextType | undefined>(undefined);

export const useProbes = (): ProbeContextType => {
  const context = useContext(ProbeContext);
  if (!context) {
    throw new Error("useProbes must be used within a ProbeProvider");
  }
  return context;
};

interface ProbeProviderProps {
  children: React.ReactNode;
}

export const ProbeProvider: React.FC<ProbeProviderProps> = ({ children }) => {
  const [probes, setProbes] = useState<Probe[]>([]);
  const [isProbeMode, setIsProbeMode] = useState(false);

  const generateProbeColor = (index: number): string => {
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

  const addProbe = useCallback(
    (probeData: Omit<Probe, "id" | "color">) => {
      const newProbe: Probe = {
        ...probeData,
        id: `probe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        color: generateProbeColor(probes.length),
      };
      setProbes((prev) => [...prev, newProbe]);
    },
    [probes.length]
  );

  const removeProbe = useCallback((probeId: string) => {
    setProbes((prev) => prev.filter((probe) => probe.id !== probeId));
  }, []);

  const toggleProbeVisibility = useCallback((probeId: string) => {
    setProbes((prev) =>
      prev.map((probe) =>
        probe.id === probeId ? { ...probe, isVisible: !probe.isVisible } : probe
      )
    );
  }, []);

  const setProbeMode = useCallback((enabled: boolean) => {
    setIsProbeMode(enabled);
  }, []);

  const clearAllProbes = useCallback(() => {
    setProbes([]);
  }, []);

  const updateProbeLabel = useCallback((probeId: string, label: string) => {
    setProbes((prev) =>
      prev.map((probe) => (probe.id === probeId ? { ...probe, label } : probe))
    );
  }, []);

  const updateProbeType = useCallback(
    (probeId: string, type: "voltage" | "current" | "power") => {
      setProbes((prev) =>
        prev.map((probe) => (probe.id === probeId ? { ...probe, type } : probe))
      );
    },
    []
  );

  const getProbesByType = useCallback(
    (type: "voltage" | "current" | "power") => {
      return probes.filter((probe) => probe.type === type);
    },
    [probes]
  );

  const contextValue: ProbeContextType = {
    probes,
    isProbeMode,
    addProbe,
    removeProbe,
    toggleProbeVisibility,
    setProbeMode,
    clearAllProbes,
    updateProbeLabel,
    updateProbeType,
    getProbesByType,
  };

  return (
    <ProbeContext.Provider value={contextValue}>
      {children}
    </ProbeContext.Provider>
  );
};
