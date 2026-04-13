import { useEffect } from "react";
import { useCircuit } from "@/context/circuit-context";
import { useProbes } from "@/context/probe-context";
import { ToolType } from "@/types/circuit";

export function useKeyboardShortcuts() {
  const { state, dispatch } = useCircuit();
  const { isProbeMode, setProbeMode } = useProbes();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "escape":
            e.preventDefault();
            // Always return to select tool when ESC is pressed
            dispatch({ type: "SET_TOOL", payload: "select" as ToolType });
            // Also clear any selections or ongoing operations
            dispatch({ type: "SELECT_COMPONENTS", payload: [] });
            break;
          case "v":
            e.preventDefault();
            dispatch({ type: "SET_TOOL", payload: "select" as ToolType });
            break;
          case "w":
            e.preventDefault();
            dispatch({ type: "SET_TOOL", payload: "wire" as ToolType });
            break;
          case "h":
            e.preventDefault();
            dispatch({ type: "SET_TOOL", payload: "pan" as ToolType });
            break;
          case "t":
            e.preventDefault();
            dispatch({ type: "SET_TOOL", payload: "text" as ToolType });
            break;
          case "e":
            e.preventDefault();
            dispatch({ type: "SET_TOOL", payload: "eraser" as ToolType });
            break;
          case "r":
            e.preventDefault();
            // Rotate selected components by 90 degrees
            if (state.viewState.selectedComponents.length > 0) {
              state.viewState.selectedComponents.forEach((id) => {
                dispatch({
                  type: "ROTATE_COMPONENT",
                  payload: { id, angle: 90 },
                });
              });
            }
            break;
          case "delete":
          case "backspace":
            e.preventDefault();
            if (state.viewState.selectedComponents.length > 0) {
              state.viewState.selectedComponents.forEach((id) => {
                dispatch({ type: "DELETE_COMPONENT", payload: id });
              });
            }
            break;
          case "+":
          case "=":
            e.preventDefault();
            dispatch({
              type: "SET_ZOOM",
              payload: state.viewState.zoom + 0.25,
            });
            break;
          case "-":
            e.preventDefault();
            dispatch({
              type: "SET_ZOOM",
              payload: state.viewState.zoom - 0.25,
            });
            break;
          case "g":
            e.preventDefault();
            dispatch({ type: "TOGGLE_GRID" });
            break;
          case "p":
            e.preventDefault();
            setProbeMode(!isProbeMode);
            break;
        }
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              dispatch({ type: "REDO" });
            } else {
              dispatch({ type: "UNDO" });
            }
            break;
          case "y":
            e.preventDefault();
            dispatch({ type: "REDO" });
            break;
          case "a":
            e.preventDefault();
            const allComponentIds = state.circuit.components.map((c) => c.id);
            dispatch({ type: "SELECT_COMPONENTS", payload: allComponentIds });
            break;
          case "d":
            e.preventDefault();
            dispatch({ type: "SELECT_COMPONENTS", payload: [] });
            break;
          case "n":
            e.preventDefault();
            dispatch({ type: "CLEAR_CIRCUIT" });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, dispatch, isProbeMode, setProbeMode]);
}
