"use client";

import { useEffect } from "react";
import { Canvas } from "@/components/circuit/canvas";
import { PropertiesPanel } from "@/components/circuit/properties-panel";
import { Layout } from "@/components/layout/layout";
import { ThemeProvider } from "@/context/theme-context";
import { CircuitProvider } from "@/context/circuit-context";
import { ProbeProvider } from "@/context/probe-context";
import { SimulationModalProvider } from "@/context/simulation-modal-context";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FloatingChatButton } from "@/components/chat/floating-chat-button";
import { useCircuit } from "@/context/circuit-context";

function MainContent() {
  const { state, dispatch } = useCircuit();

  // On mount, check if the analyze page stashed an import in sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("__circuitron_analysis_import");
      if (!raw) return;
      sessionStorage.removeItem("__circuitron_analysis_import");
      const payload = JSON.parse(raw);
      if (payload?.circuit) {
        // Rehydrate dates
        payload.circuit.metadata.createdAt = new Date(payload.circuit.metadata.createdAt);
        payload.circuit.metadata.updatedAt = new Date(payload.circuit.metadata.updatedAt);
        dispatch({ type: "IMPORT_ANALYSIS", payload });
      }
    } catch {
      // ignore parse errors
    }
  }, [dispatch]);

  const hasSelectedItems =
    state.viewState.selectedComponents.length > 0 ||
    state.viewState.selectedTextElements.length > 0;

  return (
    <div className="flex h-full">
      <Canvas className="flex-1" />
      {hasSelectedItems && <PropertiesPanel />}
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CircuitProvider>
          <ProbeProvider>
            <SimulationModalProvider>
              <Layout>
                <MainContent />
                <FloatingChatButton />
              </Layout>
            </SimulationModalProvider>
          </ProbeProvider>
        </CircuitProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
