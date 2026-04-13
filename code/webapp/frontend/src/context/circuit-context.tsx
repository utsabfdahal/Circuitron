"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import {
  Circuit,
  CircuitComponent,
  Wire,
  TextElement,
  ViewState,
  ToolType,
  Point,
} from "@/types/circuit";
import { generateId } from "@/utils";
import type { AnalysisImages } from "@/services/analysis-api";

export interface AnalysisConnection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AnalysisOverlay {
  /** base64 data-URL images from the pipeline */
  images: AnalysisImages;
  /** URL.createObjectURL of the original uploaded image */
  originalImageUrl: string | null;
  /** Original image dimensions (used for background sizing) */
  imageSize: { width: number; height: number };
  /** Detected connection lines (graph edges) in canvas coordinates */
  connections: AnalysisConnection[];
}

/** Maximum number of undo states to keep in memory */
const MAX_UNDO_STACK = 50;

interface CircuitState {
  circuit: Circuit;
  viewState: ViewState;
  clipboard: CircuitComponent[];
  undoStack: Circuit[];
  redoStack: Circuit[];
  /** Present when circuit was loaded via image analysis */
  analysisOverlay: AnalysisOverlay | null;
}

/** Push current circuit onto undo stack (with size limit) and clear redo */
function pushUndo(state: CircuitState): { undoStack: Circuit[]; redoStack: Circuit[] } {
  const stack = [...state.undoStack, state.circuit];
  if (stack.length > MAX_UNDO_STACK) {
    stack.splice(0, stack.length - MAX_UNDO_STACK);
  }
  return { undoStack: stack, redoStack: [] };
}

type CircuitAction =
  | { type: "ADD_COMPONENT"; payload: Omit<CircuitComponent, "id"> }
  | {
      type: "UPDATE_COMPONENT";
      payload: { id: string; updates: Partial<CircuitComponent> };
    }
  | { type: "DELETE_COMPONENT"; payload: string }
  | {
      type: "ROTATE_COMPONENT";
      payload: { id: string; angle: number };
    }
  | {
      type: "MOVE_COMPONENT";
      payload: { id: string; position: { x: number; y: number } };
    }
  | {
      type: "MOVE_COMPONENT_DONE";
      payload: { id: string; position: { x: number; y: number } };
    }
  | { type: "ADD_WIRE"; payload: Omit<Wire, "id"> }
  | { type: "DELETE_WIRE"; payload: string }
  | { type: "ADD_TEXT_ELEMENT"; payload: Omit<TextElement, "id"> }
  | {
      type: "UPDATE_TEXT_ELEMENT";
      payload: { id: string; updates: Partial<TextElement> };
    }
  | { type: "DELETE_TEXT_ELEMENT"; payload: string }
  | { type: "SET_TOOL"; payload: ToolType }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_PAN"; payload: Point }
  | { type: "SELECT_COMPONENTS"; payload: string[] }
  | { type: "SELECT_TEXT_ELEMENTS"; payload: string[] }
  | { type: "TOGGLE_GRID"; payload?: boolean }
  | { type: "TOGGLE_SNAP_TO_GRID"; payload?: boolean }
  | { type: "CLEAR_CIRCUIT" }
  | { type: "LOAD_CIRCUIT"; payload: Circuit }
  | {
      type: "IMPORT_ANALYSIS";
      payload: { circuit: Circuit; overlay: AnalysisOverlay };
    }
  | { type: "CLEAR_ANALYSIS_OVERLAY" }
  | { type: "UNDO" }
  | { type: "REDO" };

const initialViewState: ViewState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedTool: "select",
  selectedComponents: [],
  selectedTextElements: [],
  gridVisible: true,
  snapToGrid: true,
};

const initialCircuit: Circuit = {
  id: generateId(),
  name: "Untitled Circuit",
  components: [],
  wires: [],
  textElements: [],
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    version: "1.0.0",
  },
};

const initialState: CircuitState = {
  circuit: initialCircuit,
  viewState: initialViewState,
  clipboard: [],
  undoStack: [],
  redoStack: [],
  analysisOverlay: null,
};

function circuitReducer(
  state: CircuitState,
  action: CircuitAction
): CircuitState {
  switch (action.type) {
    case "ADD_COMPONENT": {
      const newComponent: CircuitComponent = {
        ...action.payload,
        id: generateId(),
      };

      return {
        ...state,
        circuit: {
          ...state.circuit,
          components: [...state.circuit.components, newComponent],
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "UPDATE_COMPONENT": {
      return {
        ...state,
        circuit: {
          ...state.circuit,
          components: state.circuit.components.map((comp) =>
            comp.id === action.payload.id
              ? { ...comp, ...action.payload.updates }
              : comp
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "ROTATE_COMPONENT": {
      return {
        ...state,
        circuit: {
          ...state.circuit,
          components: state.circuit.components.map((comp) =>
            comp.id === action.payload.id
              ? {
                  ...comp,
                  position: {
                    ...comp.position,
                    rotation: (comp.position.rotation + action.payload.angle) % 360,
                  },
                }
              : comp
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "MOVE_COMPONENT": {
      // Live drag preview: update position WITHOUT pushing to undo stack
      return {
        ...state,
        circuit: {
          ...state.circuit,
          components: state.circuit.components.map((comp) =>
            comp.id === action.payload.id
              ? {
                  ...comp,
                  position: {
                    ...comp.position,
                    x: action.payload.position.x,
                    y: action.payload.position.y,
                  },
                }
              : comp
          ),
        },
      };
    }

    case "MOVE_COMPONENT_DONE": {
      // Final drag drop: update position AND push undo
      return {
        ...state,
        circuit: {
          ...state.circuit,
          components: state.circuit.components.map((comp) =>
            comp.id === action.payload.id
              ? {
                  ...comp,
                  position: {
                    ...comp.position,
                    x: action.payload.position.x,
                    y: action.payload.position.y,
                  },
                }
              : comp
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "DELETE_COMPONENT": {
      return {
        ...state,
        circuit: {
          ...state.circuit,
          components: state.circuit.components.filter(
            (comp) => comp.id !== action.payload
          ),
          wires: state.circuit.wires.filter(
            (wire) =>
              wire.from?.componentId !== action.payload &&
              wire.to?.componentId !== action.payload
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        viewState: {
          ...state.viewState,
          selectedComponents: state.viewState.selectedComponents.filter(
            (id) => id !== action.payload
          ),
        },
        ...pushUndo(state),
      };
    }

    case "ADD_WIRE": {
      const newWire: Wire = {
        ...action.payload,
        id: generateId(),
      };

      return {
        ...state,
        circuit: {
          ...state.circuit,
          wires: [...state.circuit.wires, newWire],
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "ADD_TEXT_ELEMENT": {
      const newTextElement: TextElement = {
        ...action.payload,
        id: generateId(),
      };

      return {
        ...state,
        circuit: {
          ...state.circuit,
          textElements: [...state.circuit.textElements, newTextElement],
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "UPDATE_TEXT_ELEMENT": {
      return {
        ...state,
        circuit: {
          ...state.circuit,
          textElements: state.circuit.textElements.map((element) =>
            element.id === action.payload.id
              ? { ...element, ...action.payload.updates }
              : element
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "DELETE_TEXT_ELEMENT": {
      return {
        ...state,
        circuit: {
          ...state.circuit,
          textElements: state.circuit.textElements.filter(
            (element) => element.id !== action.payload
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "DELETE_WIRE": {
      return {
        ...state,
        circuit: {
          ...state.circuit,
          wires: state.circuit.wires.filter(
            (wire) => wire.id !== action.payload
          ),
          metadata: { ...state.circuit.metadata, updatedAt: new Date() },
        },
        ...pushUndo(state),
      };
    }

    case "SET_TOOL": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          selectedTool: action.payload,
        },
      };
    }

    case "SET_ZOOM": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          zoom: Math.max(0.25, Math.min(3, action.payload)),
        },
      };
    }

    case "SET_PAN": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          pan: action.payload,
        },
      };
    }

    case "SELECT_COMPONENTS": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          selectedComponents: action.payload,
        },
      };
    }

    case "SELECT_TEXT_ELEMENTS": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          selectedTextElements: action.payload,
        },
      };
    }

    case "TOGGLE_GRID": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          gridVisible: action.payload ?? !state.viewState.gridVisible,
        },
      };
    }

    case "TOGGLE_SNAP_TO_GRID": {
      return {
        ...state,
        viewState: {
          ...state.viewState,
          snapToGrid: action.payload ?? !state.viewState.snapToGrid,
        },
      };
    }

    case "CLEAR_CIRCUIT": {
      return {
        ...state,
        circuit: {
          ...initialCircuit,
          id: generateId(),
        },
        viewState: {
          ...initialViewState,
        },
        ...pushUndo(state),
      };
    }

    case "LOAD_CIRCUIT": {
      return {
        ...state,
        circuit: action.payload,
        viewState: initialViewState,
        undoStack: [],
        redoStack: [],
      };
    }

    case "IMPORT_ANALYSIS": {
      return {
        ...state,
        circuit: action.payload.circuit,
        viewState: {
          ...initialViewState,
          zoom: 0.6, // start slightly zoomed-out so full circuit is visible
        },
        undoStack: [state.circuit],
        redoStack: [],
        analysisOverlay: action.payload.overlay,
      };
    }

    case "CLEAR_ANALYSIS_OVERLAY": {
      return {
        ...state,
        analysisOverlay: null,
      };
    }

    case "UNDO": {
      if (state.undoStack.length === 0) return state;

      const previousCircuit = state.undoStack[state.undoStack.length - 1];
      const newUndoStack = state.undoStack.slice(0, -1);

      return {
        ...state,
        circuit: previousCircuit,
        undoStack: newUndoStack,
        redoStack: [state.circuit, ...state.redoStack],
      };
    }

    case "REDO": {
      if (state.redoStack.length === 0) return state;

      const nextCircuit = state.redoStack[0];
      const newRedoStack = state.redoStack.slice(1);

      return {
        ...state,
        circuit: nextCircuit,
        undoStack: [...state.undoStack, state.circuit],
        redoStack: newRedoStack,
      };
    }

    default:
      return state;
  }
}

interface CircuitContextType {
  state: CircuitState;
  dispatch: React.Dispatch<CircuitAction>;
}

const CircuitContext = createContext<CircuitContextType | undefined>(undefined);

export function useCircuit() {
  const context = useContext(CircuitContext);
  if (!context) {
    throw new Error("useCircuit must be used within a CircuitProvider");
  }
  return context;
}

interface CircuitProviderProps {
  children: ReactNode;
}

export function CircuitProvider({ children }: CircuitProviderProps) {
  const [state, dispatch] = useReducer(circuitReducer, initialState);

  return (
    <CircuitContext.Provider value={{ state, dispatch }}>
      {children}
    </CircuitContext.Provider>
  );
}
