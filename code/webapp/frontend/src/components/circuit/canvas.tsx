"use client";

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useCircuit } from "@/context/circuit-context";
import { useProbes } from "@/context/probe-context";
import {
  ComponentType,
  Point,
  CircuitComponent,
  Wire,
  TextElement,
} from "@/types/circuit";
import { COMPONENT_DEFINITIONS, GRID_SIZE, KICAD_SCALE, MIN_ZOOM, MAX_ZOOM } from "@/constants/components";
import { generateId, snapToGrid, calculateDistance } from "@/utils";
import {
  findNearestValidPosition,
  getSafeGridPosition,
  wouldPositionCauseOverlap,
} from "@/utils/collision";
import { cn } from "@/utils";
import { ProbeOverlay } from "@/components/simulation/probe-overlay";
import { ComponentIcon } from "@/components/circuit/component-icons";
import {
  getKicadSymbol,
  getKicadPinPositions,
  renderKicadSymbolInline,
} from "@/components/circuit/kicad-symbol-renderer";

/**
 * Calculate a terminal's world position, accounting for component rotation.
 * Terminal positions are stored relative to the component origin;
 * we rotate them by the component's rotation angle before adding the offset.
 */
function getRotatedTerminalPosition(
  compPos: { x: number; y: number; rotation: number },
  terminalLocalPos: Point,
  rotation: number
): Point {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: compPos.x + terminalLocalPos.x * cos - terminalLocalPos.y * sin,
    y: compPos.y + terminalLocalPos.x * sin + terminalLocalPos.y * cos,
  };
}

/** Project point P onto line segment AB.  Returns the closest point on AB. */
function projectPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...a };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// ── LTspice-style colour tokens (read from CSS custom properties) ─────────
const W = "var(--wire-color)";
const CS = "var(--component-stroke)";
const TC = "var(--terminal-color)";
const JC = "var(--junction-color)";
const GD = "var(--grid-dot)";
const LBL = "var(--label-color)";
const SEL = "var(--selection-color)";
const JUNCTION_R = 4; // junction dot radius (canvas px)
const TERMINAL_R = 3; // terminal dot radius (canvas px)

/**
 * Build terminal positions from KiCad pin data.
 * Returns array of {x, y} in canvas pixels (Y-flipped).
 * Falls back to generic left/right placement if no KiCad data.
 */
function terminalPositionsForType(
  componentType: ComponentType,
  terminalDefs: { type: "input" | "output" | "bidirectional" }[],
): { x: number; y: number }[] {
  const kicadPins = getKicadPinPositions(componentType);
  if (kicadPins && kicadPins.length === terminalDefs.length) {
    return kicadPins.map((pin) => ({
      x: snapToGrid(pin.x * KICAD_SCALE, GRID_SIZE),
      y: snapToGrid(-pin.y * KICAD_SCALE, GRID_SIZE), // flip Y
    }));
  }
  // Fallback: spread along X axis
  const count = terminalDefs.length;
  if (count === 1) return [{ x: 0, y: 20 }];
  return terminalDefs.map((_, i) => ({
    x: i === 0 ? -40 : 40,
    y: 0,
  }));
}

/**
 * Compute junction points – where 3+ wire segments share an endpoint.
 */
function computeJunctions(
  wires: Wire[],
  resolvePos: (ref: { componentId: string; terminalId: string } | undefined) => Point | null,
): Point[] {
  const K = (p: Point) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const counts = new Map<string, number>();

  for (const wire of wires) {
    if (wire.points.length < 2) continue;
    const pts = [...wire.points];
    const fromPos = resolvePos(wire.from);
    if (fromPos) pts[0] = fromPos;
    const toPos = resolvePos(wire.to);
    if (toPos) pts[pts.length - 1] = toPos;

    for (let i = 0; i < pts.length - 1; i++) {
      const ka = K(pts[i]);
      const kb = K(pts[i + 1]);
      counts.set(ka, (counts.get(ka) || 0) + 1);
      counts.set(kb, (counts.get(kb) || 0) + 1);
    }
  }

  const junctions: Point[] = [];
  counts.forEach((c, key) => {
    if (c >= 3) {
      const [x, y] = key.split(",").map(Number);
      junctions.push({ x, y });
    }
  });
  return junctions;
}

interface CanvasProps {
  className?: string;
}

export function Canvas({ className }: CanvasProps) {
  const { state, dispatch } = useCircuit();
  const { isProbeMode, addProbe } = useProbes();
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Analysis overlay visibility
  const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(true);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<Point | null>(null);
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const mousePosRef = useRef<Point>({ x: 0, y: 0 });
  const mousePosRafRef = useRef<number | null>(null);
  const [isDraggingComponent, setIsDraggingComponent] = useState(false);
  const [draggedComponentId, setDraggedComponentId] = useState<string | null>(
    null
  );
  const [componentDragStart, setComponentDragStart] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [componentDragOffset, setComponentDragOffset] = useState<Point>({
    x: 0,
    y: 0,
  });

  // Text element dragging state
  const [isDraggingTextElement, setIsDraggingTextElement] = useState(false);
  const [draggedTextElementId, setDraggedTextElementId] = useState<
    string | null
  >(null);
  const [textElementDragStart, setTextElementDragStart] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [textElementDragOffset, setTextElementDragOffset] = useState<Point>({
    x: 0,
    y: 0,
  });

  // Wire drawing state (LTSpice-like: click to place points, double-click/Esc to finish)
  const [wireStartNode, setWireStartNode] = useState<{
    componentId: string;
    terminalId: string;
  } | null>(null);
  const [wirePoints, setWirePoints] = useState<Point[]>([]);
  const [isDrawingWire, setIsDrawingWire] = useState(false);
  const [hoveredTerminal, setHoveredTerminal] = useState<{
    componentId: string;
    terminalId: string;
  } | null>(null);

  // Text editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [textEditPosition, setTextEditPosition] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [textEditCanvasPosition, setTextEditCanvasPosition] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [textEditValue, setTextEditValue] = useState("");
  const [isTextInputReady, setIsTextInputReady] = useState(false); // Prevent immediate blur
  const textInputRef = useRef<HTMLInputElement>(null);

  // Handle ESC key to cancel ongoing operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Cancel/finish wire drawing
        if (isDrawingWire) {
          // If we have at least 2 points, save the wire
          if (wirePoints.length >= 2) {
            dispatch({
              type: "ADD_WIRE",
              payload: {
                from: wireStartNode ?? undefined,
                points: wirePoints,
              },
            });
          }
          setIsDrawingWire(false);
          setWirePoints([]);
          setWireStartNode(null);
          setHoveredTerminal(null);
        }

        // Cancel component dragging
        if (isDraggingComponent) {
          setIsDraggingComponent(false);
          setDraggedComponentId(null);
          setComponentDragOffset({ x: 0, y: 0 });
        }

        // Cancel text editing
        if (isEditingText) {
          setIsEditingText(false);
          setTextEditValue("");
        }

        // Cancel text element dragging
        if (isDraggingTextElement) {
          setIsDraggingTextElement(false);
          setDraggedTextElementId(null);
          setTextElementDragOffset({ x: 0, y: 0 });
        }

        // Cancel pan dragging
        if (isDragging) {
          setIsDragging(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isDrawingWire,
    wireStartNode,
    wirePoints,
    isDraggingComponent,
    isDragging,
    isEditingText,
    isDraggingTextElement,
  ]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Point => {
      if (!canvasRef.current) return { x: 0, y: 0 };

      const rect = canvasRef.current.getBoundingClientRect();
      const x =
        (screenX - rect.left - state.viewState.pan.x) / state.viewState.zoom;
      const y =
        (screenY - rect.top - state.viewState.pan.y) / state.viewState.zoom;

      return {
        x: state.viewState.snapToGrid ? snapToGrid(x, GRID_SIZE) : x,
        y: state.viewState.snapToGrid ? snapToGrid(y, GRID_SIZE) : y,
      };
    },
    [state.viewState.pan, state.viewState.zoom, state.viewState.snapToGrid]
  );

  // Convert screen to canvas coordinates WITHOUT grid snapping (for eraser hit detection)
  const screenToCanvasRaw = useCallback(
    (screenX: number, screenY: number): Point => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - state.viewState.pan.x) / state.viewState.zoom,
        y: (screenY - rect.top - state.viewState.pan.y) / state.viewState.zoom,
      };
    },
    [state.viewState.pan, state.viewState.zoom]
  );

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): Point => {
      return {
        x: canvasX * state.viewState.zoom + state.viewState.pan.x,
        y: canvasY * state.viewState.zoom + state.viewState.pan.y,
      };
    },
    [state.viewState.pan, state.viewState.zoom]
  );

  // Handle mouse events
  // Handle probe placement
  const handleProbeClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isProbeMode || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert screen coordinates to canvas coordinates
      const canvasPosition = {
        x: (x - state.viewState.pan.x) / state.viewState.zoom,
        y: (y - state.viewState.pan.y) / state.viewState.zoom,
      };

      // Snap to grid for better node detection
      const snappedPosition = {
        x: snapToGrid(canvasPosition.x, GRID_SIZE),
        y: snapToGrid(canvasPosition.y, GRID_SIZE),
      };

      // Find nearest component or node
      let probeLabel = `Probe ${Date.now().toString().slice(-4)}`;
      let nodeId = `node_${snappedPosition.x}_${snappedPosition.y}`;

      // Check if we're clicking on a component
      const clickedComponent = state.circuit.components.find((component) => {
        const distance = calculateDistance(snappedPosition, component.position);
        return distance < 30; // 30px tolerance
      });

      if (clickedComponent) {
        probeLabel = `V(${clickedComponent.label || clickedComponent.type})`;
        nodeId = `${clickedComponent.id}_terminal`;
      }

      // Add the probe
      addProbe({
        type: "voltage",
        position: { x, y }, // Use screen coordinates for rendering
        nodeId,
        label: probeLabel,
        isVisible: true,
      });

      event.stopPropagation();
    },
    [
      isProbeMode,
      state.viewState.pan,
      state.viewState.zoom,
      state.circuit.components,
      addProbe,
    ]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    // If in probe mode, handle probe placement
    if (isProbeMode) {
      handleProbeClick(e);
      return;
    }
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    if (state.viewState.selectedTool === "pan") {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (state.viewState.selectedTool === "wire") {
      // LTSpice-like orthogonal wire placement
      const foundTerminal = findTerminalAt(canvasPos);
      const clickPos = foundTerminal ? foundTerminal.terminalPos : canvasPos;

      if (!isDrawingWire) {
        // First click — start a new wire
        setIsDrawingWire(true);
        setWirePoints([clickPos]);
        setWireStartNode(
          foundTerminal
            ? { componentId: foundTerminal.componentId, terminalId: foundTerminal.terminalId }
            : null
        );
      } else {
        // Subsequent click — auto-insert orthogonal L-bend then add endpoint
        const last = wirePoints[wirePoints.length - 1];
        const dx = Math.abs(clickPos.x - last.x);
        const dy = Math.abs(clickPos.y - last.y);
        let newPoints: Point[];
        if (dx > 1 && dy > 1) {
          // L-bend: horizontal first, then vertical
          const corner: Point = { x: clickPos.x, y: last.y };
          newPoints = [...wirePoints, corner, clickPos];
        } else {
          newPoints = [...wirePoints, clickPos];
        }

        if (foundTerminal) {
          // Clicked on a terminal → finish the wire
          const toRef = {
            componentId: foundTerminal.componentId,
            terminalId: foundTerminal.terminalId,
          };
          // Don't finish if clicking the same terminal we started on
          if (
            wireStartNode &&
            toRef.componentId === wireStartNode.componentId &&
            toRef.terminalId === wireStartNode.terminalId &&
            newPoints.length <= 2
          ) {
            return;
          }

          dispatch({
            type: "ADD_WIRE",
            payload: {
              from: wireStartNode ?? undefined,
              to: toRef,
              points: newPoints,
            },
          });
          setIsDrawingWire(false);
          setWirePoints([]);
          setWireStartNode(null);
          setHoveredTerminal(null);
        } else {
          // Not on a terminal — just update the placed points
          setWirePoints(newPoints);
        }
      }
    } else if (state.viewState.selectedTool === "select") {
      // Handle selection and dragging for both components and text elements
      const clickedComponent = findComponentAt(canvasPos);
      const clickedTextElement = findTextElementAt(canvasPos);

      if (clickedComponent) {
        // Clear text element selection when selecting component
        if (state.viewState.selectedTextElements.length > 0) {
          dispatch({ type: "SELECT_TEXT_ELEMENTS", payload: [] });
        }

        if (e.ctrlKey || e.metaKey) {
          // Multi-select components
          const newSelection = state.viewState.selectedComponents.includes(
            clickedComponent.id
          )
            ? state.viewState.selectedComponents.filter(
                (id) => id !== clickedComponent.id
              )
            : [...state.viewState.selectedComponents, clickedComponent.id];
          dispatch({ type: "SELECT_COMPONENTS", payload: newSelection });
        } else {
          // Single click: select component only (shows properties panel)
          // Double-click is required to move/drag
          dispatch({
            type: "SELECT_COMPONENTS",
            payload: [clickedComponent.id],
          });
        }
      } else if (clickedTextElement) {
        // Clear component selection when selecting text element
        if (state.viewState.selectedComponents.length > 0) {
          dispatch({ type: "SELECT_COMPONENTS", payload: [] });
        }

        if (e.ctrlKey || e.metaKey) {
          // Multi-select text elements
          const newSelection = state.viewState.selectedTextElements.includes(
            clickedTextElement.id
          )
            ? state.viewState.selectedTextElements.filter(
                (id) => id !== clickedTextElement.id
              )
            : [...state.viewState.selectedTextElements, clickedTextElement.id];
          dispatch({ type: "SELECT_TEXT_ELEMENTS", payload: newSelection });
        } else {
          // Single select text element and prepare for dragging
          dispatch({
            type: "SELECT_TEXT_ELEMENTS",
            payload: [clickedTextElement.id],
          });

          // Start dragging text element immediately
          setIsDraggingTextElement(true);
          setDraggedTextElementId(clickedTextElement.id);
          setTextElementDragStart(canvasPos);
          setTextElementDragOffset({ x: 0, y: 0 });
        }
      } else {
        // Clear all selections
        dispatch({ type: "SELECT_COMPONENTS", payload: [] });
        dispatch({ type: "SELECT_TEXT_ELEMENTS", payload: [] });
      }
    } else if (state.viewState.selectedTool === "text") {
      // Check if clicking on existing text element
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const clickedTextElement = findTextElementAt(canvasPos);

      if (clickedTextElement) {
        // If clicking on existing text, select it and switch to select tool
        dispatch({
          type: "SELECT_TEXT_ELEMENTS",
          payload: [clickedTextElement.id],
        });
        // Clear component selection
        dispatch({ type: "SELECT_COMPONENTS", payload: [] });
        // Switch to select tool for editing in properties panel
        dispatch({ type: "SET_TOOL", payload: "select" });
        return;
      }

      // Only create new text if not clicking on existing text
      const rect = canvasRef.current?.getBoundingClientRect();

      if (rect) {
        // Store the canvas position for later use when creating the text element
        setTextEditCanvasPosition(canvasPos);

        // Position the input at the click location
        const editPos = {
          x: e.clientX - rect.left + 10, // Add small offset from click point
          y: e.clientY - rect.top - 20, // Position above the click point
        };

        setTextEditPosition(editPos);
        setTextEditValue("");
        setIsEditingText(true);
        setIsTextInputReady(false); // Reset ready state

        // Focus the input after a brief delay to ensure it's rendered
        setTimeout(() => {
          if (textInputRef.current) {
            textInputRef.current.focus();
            textInputRef.current.select();
            setIsTextInputReady(true); // Mark as ready after focus
          }
        }, 150);
      }
    } else if (state.viewState.selectedTool === "eraser") {
      // Eraser mode: click on wires, components, or text elements to delete them
      // Use raw (non-snapped) coordinates for accurate hit detection
      const rawCanvasPos = screenToCanvasRaw(e.clientX, e.clientY);

      // Check wires first (click within distance of any wire segment)
      const clickedWire = findWireAt(rawCanvasPos);
      if (clickedWire) {
        dispatch({ type: "DELETE_WIRE", payload: clickedWire.id });
        return;
      }

      // Check components
      const clickedComponent = findComponentAt(rawCanvasPos);
      if (clickedComponent) {
        dispatch({ type: "DELETE_COMPONENT", payload: clickedComponent.id });
        return;
      }

      // Check text elements
      const clickedTextElement = findTextElementAt(rawCanvasPos);
      if (clickedTextElement) {
        dispatch({ type: "DELETE_TEXT_ELEMENT", payload: clickedTextElement.id });
        return;
      }
    }
  };

  // Handle double-click — finish wire drawing or start dragging component
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (state.viewState.selectedTool === "wire" && isDrawingWire) {
      // Double-click finishes the wire at current mouse position
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const foundTerminal = findTerminalAt(canvasPos);
      const endPos = foundTerminal ? foundTerminal.terminalPos : canvasPos;

      // Add orthogonal L-bend if needed
      const last = wirePoints[wirePoints.length - 1];
      const dx = Math.abs(endPos.x - last.x);
      const dy = Math.abs(endPos.y - last.y);
      let finalPoints: Point[];
      if (dx > 1 && dy > 1) {
        const corner: Point = { x: endPos.x, y: last.y };
        finalPoints = [...wirePoints, corner, endPos];
      } else {
        finalPoints = [...wirePoints, endPos];
      }

      if (finalPoints.length >= 2) {
        dispatch({
          type: "ADD_WIRE",
          payload: {
            from: wireStartNode ?? undefined,
            to: foundTerminal
              ? { componentId: foundTerminal.componentId, terminalId: foundTerminal.terminalId }
              : undefined,
            points: finalPoints,
          },
        });
      }
      setIsDrawingWire(false);
      setWirePoints([]);
      setWireStartNode(null);
      setHoveredTerminal(null);
      return;
    }

    if (state.viewState.selectedTool === "select") {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const clickedComponent = findComponentAt(canvasPos);

      if (clickedComponent) {
        setIsDraggingComponent(true);
        setDraggedComponentId(clickedComponent.id);
        setComponentDragStart(canvasPos);

        // Select the component if not already selected
        if (!state.viewState.selectedComponents.includes(clickedComponent.id)) {
          dispatch({
            type: "SELECT_COMPONENTS",
            payload: [clickedComponent.id],
          });
        }
      }
    }
  };

  // Handle component drag on mouse move
  const handleComponentDrag = (e: React.MouseEvent) => {
    if (isDraggingComponent && draggedComponentId) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const deltaX = canvasPos.x - componentDragStart.x;
      const deltaY = canvasPos.y - componentDragStart.y;

      // Update drag offset for visual feedback
      setComponentDragOffset({ x: deltaX, y: deltaY });
    }
  };

  // Handle text element drag on mouse move
  const handleTextElementDrag = (e: React.MouseEvent) => {
    if (isDraggingTextElement && draggedTextElementId) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const deltaX = canvasPos.x - textElementDragStart.x;
      const deltaY = canvasPos.y - textElementDragStart.y;

      // Update drag offset for visual feedback
      setTextElementDragOffset({ x: deltaX, y: deltaY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    mousePosRef.current = canvasPos;

    // Throttle status-bar re-renders via rAF
    if (!mousePosRafRef.current) {
      mousePosRafRef.current = requestAnimationFrame(() => {
        setMousePosition(mousePosRef.current);
        mousePosRafRef.current = null;
      });
    }

    // Handle terminal hover detection for wire tool
    if (state.viewState.selectedTool === "wire") {
      const foundTerminal = findTerminalAt(canvasPos);
      setHoveredTerminal(
        foundTerminal
          ? {
              componentId: foundTerminal.componentId,
              terminalId: foundTerminal.terminalId,
            }
          : null
      );
    }

    // Handle component dragging
    if (isDraggingComponent) {
      handleComponentDrag(e);
      return;
    }

    // Handle text element dragging
    if (isDraggingTextElement) {
      handleTextElementDrag(e);
      return;
    }

    // Handle pan dragging
    if (isDragging && state.viewState.selectedTool === "pan") {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      dispatch({
        type: "SET_PAN",
        payload: {
          x: state.viewState.pan.x + deltaX,
          y: state.viewState.pan.y + deltaY,
        },
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    // Commit component drag position if dragging
    if (isDraggingComponent && draggedComponentId) {
      const draggedComponent = state.circuit.components.find(
        (c) => c.id === draggedComponentId
      );
      if (
        draggedComponent &&
        (componentDragOffset.x !== 0 || componentDragOffset.y !== 0)
      ) {
        const targetPosition = {
          x: draggedComponent.position.x + componentDragOffset.x,
          y: draggedComponent.position.y + componentDragOffset.y,
        };

        // Find a safe position that doesn't cause overlap
        const safePosition = findNearestValidPosition(
          targetPosition,
          state.circuit.components,
          draggedComponentId, // Exclude the component being moved
          state.viewState.snapToGrid
        );

        dispatch({
          type: "UPDATE_COMPONENT",
          payload: {
            id: draggedComponentId,
            updates: {
              position: {
                ...draggedComponent.position,
                x: safePosition.x,
                y: safePosition.y,
              },
            },
          },
        });
      }
    }

    // Commit text element drag position if dragging
    if (isDraggingTextElement && draggedTextElementId) {
      const draggedTextElement = state.circuit.textElements.find(
        (t) => t.id === draggedTextElementId
      );
      if (
        draggedTextElement &&
        (textElementDragOffset.x !== 0 || textElementDragOffset.y !== 0)
      ) {
        const targetPosition = {
          x: draggedTextElement.position.x + textElementDragOffset.x,
          y: draggedTextElement.position.y + textElementDragOffset.y,
        };

        // Apply grid snapping if enabled
        const finalPosition = state.viewState.snapToGrid
          ? {
              x: snapToGrid(targetPosition.x, GRID_SIZE),
              y: snapToGrid(targetPosition.y, GRID_SIZE),
            }
          : targetPosition;

        dispatch({
          type: "UPDATE_TEXT_ELEMENT",
          payload: {
            id: draggedTextElementId,
            updates: {
              position: finalPosition,
            },
          },
        });
      }
    }

    setIsDragging(false);
    setIsDraggingComponent(false);
    setDraggedComponentId(null);
    setComponentDragOffset({ x: 0, y: 0 });
    setIsDraggingTextElement(false);
    setDraggedTextElementId(null);
    setTextElementDragOffset({ x: 0, y: 0 });
  };

  // Handle drag and drop from sidebar
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData(
      "componentType"
    ) as ComponentType;
    if (!componentType) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const componentDef = COMPONENT_DEFINITIONS[componentType];

    // Find a safe position that doesn't overlap with existing components
    const safePosition = getSafeGridPosition(
      canvasPos,
      state.circuit.components
    );

    const newComponent: Omit<CircuitComponent, "id"> = {
      type: componentType,
      position: {
        x: safePosition.x,
        y: safePosition.y,
        rotation: 0,
      },
      properties: { ...componentDef.defaultProperties },
      terminals: (() => {
        const positions = terminalPositionsForType(componentType, componentDef.terminals);
        return componentDef.terminals.map((terminal, index) => ({
          id: generateId(),
          position: positions[index],
          type: terminal.type,
        }));
      })(),
      label: componentDef.name,
    };

    dispatch({ type: "ADD_COMPONENT", payload: newComponent });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // Find component at given position
  const findComponentAt = (position: Point): CircuitComponent | null => {
    return (
      state.circuit.components.find((component) => {
        const distance = calculateDistance(position, component.position);
        return distance < 30; // 30px hit area
      }) || null
    );
  };

  // Find text element at position
  const findTextElementAt = (position: Point): TextElement | null => {
    return (
      state.circuit.textElements.find((textElement) => {
        const distance = calculateDistance(position, textElement.position);
        return distance < 25; // 25px hit area for text
      }) || null
    );
  };

  // Find wire at position (closest point on any wire segment within tolerance)
  const findWireAt = (position: Point): Wire | null => {
    const WIRE_HIT_RADIUS = 15;
    for (const wire of state.circuit.wires) {
      if (wire.points.length < 2) continue;
      // Resolve endpoints with terminal positions
      const pts = [...wire.points];
      const fromPos = resolveTerminalPos(wire.from);
      if (fromPos) pts[0] = fromPos;
      const toPos = resolveTerminalPos(wire.to);
      if (toPos) pts[pts.length - 1] = toPos;

      for (let i = 0; i < pts.length - 1; i++) {
        const proj = projectPointOnSegment(position, pts[i], pts[i + 1]);
        const d = calculateDistance(position, proj);
        if (d < WIRE_HIT_RADIUS) return wire;
      }
    }
    return null;
  };

  // Find terminal at position (with tolerance radius)
  const findTerminalAt = (
    position: Point
  ): { componentId: string; terminalId: string; terminalPos: Point } | null => {
    const TERMINAL_RADIUS = 25; // Larger hit area for easier terminal selection

    for (const component of state.circuit.components) {
      for (const terminal of component.terminals) {
        // Calculate terminal world position accounting for component rotation
        const terminalWorldPos = getRotatedTerminalPosition(
          component.position,
          terminal.position,
          component.position.rotation
        );

        const distance = calculateDistance(position, terminalWorldPos);
        if (distance < TERMINAL_RADIUS) {
          return {
            componentId: component.id,
            terminalId: terminal.id,
            terminalPos: terminalWorldPos,
          };
        }
      }
    }

    return null;
  };

  /**
   * Split a wire at the closest point to `clickPos`.
   * Removes the original wire and creates two new wires from
   * the split point.
   */
  const splitWireAt = (wireId: string, clickPos: Point) => {
    const wire = state.circuit.wires.find((w) => w.id === wireId);
    if (!wire || wire.points.length < 2) return;

    // Find closest segment
    let bestDist = Infinity;
    let bestIdx = 0;
    let bestProj: Point = clickPos;

    for (let i = 0; i < wire.points.length - 1; i++) {
      const a = wire.points[i];
      const b = wire.points[i + 1];
      const proj = projectPointOnSegment(clickPos, a, b);
      const d = calculateDistance(clickPos, proj);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
        bestProj = {
          x: state.viewState.snapToGrid ? snapToGrid(proj.x, GRID_SIZE) : Math.round(proj.x),
          y: state.viewState.snapToGrid ? snapToGrid(proj.y, GRID_SIZE) : Math.round(proj.y),
        };
      }
    }

    // Build two halves
    const firstHalf = [...wire.points.slice(0, bestIdx + 1), bestProj];
    const secondHalf = [bestProj, ...wire.points.slice(bestIdx + 1)];

    // Delete old wire, add two new ones
    dispatch({ type: "DELETE_WIRE", payload: wireId });
    if (firstHalf.length >= 2) {
      dispatch({ type: "ADD_WIRE", payload: { from: wire.from, points: firstHalf } });
    }
    if (secondHalf.length >= 2) {
      dispatch({ type: "ADD_WIRE", payload: { to: wire.to, points: secondHalf } });
    }
  };

  // Render dot grid using SVG <pattern> — avoids creating thousands of DOM nodes.
  const renderGrid = useMemo(() => {
    if (!state.viewState.gridVisible) return null;

    const dotR = Math.max(0.8, 1 / state.viewState.zoom); // keeps dots ~1px on screen

    return (
      <>
        <defs>
          <pattern
            id="grid-dot-pattern"
            width={GRID_SIZE}
            height={GRID_SIZE}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={0} cy={0} r={dotR} fill={GD} />
          </pattern>
        </defs>
        <rect
          x={-100000}
          y={-100000}
          width={200000}
          height={200000}
          fill="url(#grid-dot-pattern)"
        />
      </>
    );
  }, [state.viewState.gridVisible, state.viewState.zoom]);

  // ── Render components (direct SVG – LTspice style) ────────────────────────
  const renderComponents = useMemo(() => {
    return state.circuit.components.map((component) => {
      const isDraggedComponent =
        isDraggingComponent && draggedComponentId === component.id;
      const effectiveX = isDraggedComponent
        ? component.position.x + componentDragOffset.x
        : component.position.x;
      const effectiveY = isDraggedComponent
        ? component.position.y + componentDragOffset.y
        : component.position.y;

      const wouldOverlap =
        isDraggedComponent &&
        wouldPositionCauseOverlap(
          { x: effectiveX, y: effectiveY },
          state.circuit.components,
          component.id
        );

      const isSelected = state.viewState.selectedComponents.includes(
        component.id
      );

      // Determine a bounding box for the hit-area / selection rect
      const sym = getKicadSymbol(component.type);
      const compScale = component.symbolScale ?? 1;
      let hitHalfW = 45 * compScale;
      let hitHalfH = 45 * compScale;
      if (sym) {
        const bx = (sym.bounds.maxX - sym.bounds.minX) * KICAD_SCALE * compScale;
        const by = (sym.bounds.maxY - sym.bounds.minY) * KICAD_SCALE * compScale;
        hitHalfW = Math.max(bx / 2 + 10, 25);
        hitHalfH = Math.max(by / 2 + 10, 25);
      }

      // Label offset: place label next to the symbol bounding box
      const labelOffsetX = hitHalfW + 4;
      const effectiveKicadScale = KICAD_SCALE * compScale;

      return (
        <g
          key={component.id}
          transform={`translate(${effectiveX}, ${effectiveY}) rotate(${component.position.rotation})`}
        >
          {/* Invisible hit area */}
          <rect
            x={-hitHalfW}
            y={-hitHalfH}
            width={hitHalfW * 2}
            height={hitHalfH * 2}
            fill="transparent"
            stroke="none"
            style={{
              cursor: state.viewState.selectedTool === "eraser" ? "crosshair" : undefined,
            }}
            onMouseDown={(e) => {
              if (state.viewState.selectedTool === "eraser" && e.button === 0) {
                e.stopPropagation();
                dispatch({ type: "DELETE_COMPONENT", payload: component.id });
              }
            }}
          />

          {/* Selection / overlap indicator */}
          {(isSelected || wouldOverlap) && (
            <rect
              x={-hitHalfW}
              y={-hitHalfH}
              width={hitHalfW * 2}
              height={hitHalfH * 2}
              fill={wouldOverlap ? "rgba(220,38,38,0.08)" : "transparent"}
              stroke={wouldOverlap ? "#dc2626" : SEL}
              strokeWidth={1.5 / state.viewState.zoom}
              strokeDasharray={wouldOverlap ? "0" : "5 3"}
              rx={2}
            />
          )}

          {/* KiCad symbol (or fallback icon), scaled by symbolScale */}
          {sym
            ? renderKicadSymbolInline(component.type, effectiveKicadScale, CS)
            : (
              <foreignObject x={-45} y={-18} width={90} height={36}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    color: CS,
                  }}
                >
                  <ComponentIcon type={component.type} size={90} />
                </div>
              </foreignObject>
            )}

          {/* Component label (right side) */}
          {component.label && (
            <text
              x={labelOffsetX}
              y={-4}
              textAnchor="start"
              fontSize={11}
              fontWeight="500"
              fontFamily="Arial, Helvetica, sans-serif"
              fill={LBL}
            >
              {component.label}
            </text>
          )}

          {/* Component value */}
          {component.properties.detectedValue && (
            <text
              x={labelOffsetX}
              y={10}
              textAnchor="start"
              fontSize={10}
              fontWeight="400"
              fontFamily="Arial, Helvetica, sans-serif"
              fill={LBL}
            >
              {String(component.properties.detectedValue)}
            </text>
          )}

          {/* Terminal dots */}
          {component.terminals.map((terminal) => {
            const isHovered =
              hoveredTerminal?.componentId === component.id &&
              hoveredTerminal?.terminalId === terminal.id;
            const isStartNode =
              wireStartNode?.componentId === component.id &&
              wireStartNode?.terminalId === terminal.id;

            return (
              <g key={terminal.id}>
                {/* Hover/Start highlight ring */}
                {(isHovered || isStartNode) && (
                  <circle
                    cx={terminal.position.x}
                    cy={terminal.position.y}
                    r={10}
                    fill="rgba(0,100,0,0.15)"
                    stroke={TC}
                    strokeWidth={2}
                  />
                )}
                {/* Terminal endpoint dot */}
                <circle
                  cx={terminal.position.x}
                  cy={terminal.position.y}
                  r={TERMINAL_R}
                  fill={isStartNode || isHovered ? TC : TC}
                  stroke="none"
                  className="component-terminal"
                  style={{
                    cursor:
                      state.viewState.selectedTool === "wire"
                        ? "crosshair"
                        : "default",
                  }}
                />
              </g>
            );
          })}
        </g>
      );
    });
  }, [state.circuit.components, state.viewState.selectedComponents, state.viewState.selectedTool, state.viewState.zoom, isDraggingComponent, draggedComponentId, componentDragOffset, hoveredTerminal, wireStartNode]);

  /**
   * Resolve the world-position of a wire's `from` or `to` terminal reference.
   * Uses the rotation-aware helper so wire endpoints track rotated components.
   */
  const resolveTerminalPos = (
    ref: { componentId: string; terminalId: string } | undefined
  ): Point | null => {
    if (!ref) return null;
    const comp = state.circuit.components.find((c) => c.id === ref.componentId);
    if (!comp) return null;
    const term = comp.terminals.find((t) => t.id === ref.terminalId);
    if (!term) return null;
    return getRotatedTerminalPosition(comp.position, term.position, comp.position.rotation);
  };

  // Pre-compute junction dots (memoised on wires + components)
  const junctions = useMemo(
    () => computeJunctions(state.circuit.wires, resolveTerminalPos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.circuit.wires, state.circuit.components],
  );

  // ── Render wires (canvas-space, LTspice style) ──────────────────────────
  const renderWires = useMemo(() => {
    return state.circuit.wires.map((wire) => {
      if (wire.points.length < 2) return null;

      // Snap endpoints to actual terminal positions (rotation-aware)
      const resolvedPoints = [...wire.points];
      const fromPos = resolveTerminalPos(wire.from);
      if (fromPos) resolvedPoints[0] = fromPos;
      const toPos = resolveTerminalPos(wire.to);
      if (toPos) resolvedPoints[resolvedPoints.length - 1] = toPos;

      const pathData =
        `M ${resolvedPoints[0].x} ${resolvedPoints[0].y}` +
        resolvedPoints.slice(1).map((p) => ` L ${p.x} ${p.y}`).join("");

      return (
        <g key={wire.id}>
          {/* Thick invisible hit area for interactions */}
          <path
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={14}
            style={{
              pointerEvents: "stroke",
              cursor: state.viewState.selectedTool === "eraser" ? "crosshair" : "pointer",
            }}
            onMouseDown={(e) => {
              if (state.viewState.selectedTool === "eraser" && e.button === 0) {
                e.stopPropagation();
                dispatch({ type: "DELETE_WIRE", payload: wire.id });
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              const clickCanvas = screenToCanvas(e.clientX, e.clientY);
              splitWireAt(wire.id, clickCanvas);
            }}
          />
          {/* Visible wire */}
          <path d={pathData} className="wire-path" />
        </g>
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.circuit.wires, state.circuit.components, state.viewState.selectedTool]);

  // ── Render junction dots ──────────────────────────────────────────────────
  const renderJunctions = useMemo(() =>
    junctions.map((pt, i) => (
      <circle
        key={`jn-${i}`}
        cx={pt.x}
        cy={pt.y}
        r={JUNCTION_R}
        fill={JC}
        stroke="none"
      />
    )),
  [junctions]);

  // ── Connection preview (orthogonal L-bend, LTspice style) ─────────────────
  const renderConnectionPreview = () => {
    if (!isDrawingWire || wirePoints.length === 0) return null;

    const last = wirePoints[wirePoints.length - 1];
    const mx = mousePosition.x;
    const my = mousePosition.y;

    // Build committed segments path
    const committedPath = wirePoints
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`))
      .join("");

    // Orthogonal L-bend from last placed point to mouse
    // Horizontal-first by default
    const cornerX = mx;
    const cornerY = last.y;
    const needsBend = Math.abs(mx - last.x) > 1 && Math.abs(my - last.y) > 1;
    const livePath = needsBend
      ? `M ${last.x} ${last.y} L ${cornerX} ${cornerY} L ${mx} ${my}`
      : `M ${last.x} ${last.y} L ${mx} ${my}`;

    return (
      <>
        {/* Already-committed segments */}
        {wirePoints.length >= 2 && (
          <path
            d={committedPath}
            fill="none"
            stroke={W}
            strokeWidth={2}
            opacity={0.85}
          />
        )}
        {/* Live orthogonal preview to mouse */}
        <path
          d={livePath}
          fill="none"
          stroke={W}
          strokeWidth={2}
          strokeDasharray="6,4"
          opacity={0.55}
        />
        {/* Start dot */}
        <circle
          cx={wirePoints[0].x}
          cy={wirePoints[0].y}
          r={TERMINAL_R + 1}
          fill="none"
          stroke={W}
          strokeWidth={1.5}
        />
        {/* Intermediate placed dots */}
        {wirePoints.slice(1).map((p, i) => (
          <circle
            key={`wp-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={W}
            opacity={0.7}
          />
        ))}
      </>
    );
  };

  // ── Render text elements (canvas-space) ────────────────────────────────────
  const renderTextElements = useMemo(() => {
    return state.circuit.textElements.map((textElement) => {
      const isDraggedTextElement =
        isDraggingTextElement && draggedTextElementId === textElement.id;
      const effectiveX = isDraggedTextElement
        ? textElement.position.x + textElementDragOffset.x
        : textElement.position.x;
      const effectiveY = isDraggedTextElement
        ? textElement.position.y + textElementDragOffset.y
        : textElement.position.y;

      const isSelected = state.viewState.selectedTextElements.includes(
        textElement.id
      );

      return (
        <g key={textElement.id}>
          {/* Selection background */}
          {isSelected && (
            <rect
              x={effectiveX - 4}
              y={effectiveY - textElement.fontSize / 2 - 2}
              width={
                textElement.text.length * (textElement.fontSize * 0.6) + 8
              }
              height={textElement.fontSize + 4}
              fill="rgba(26,115,232,0.08)"
              stroke={SEL}
              strokeWidth={1}
              rx={2}
            />
          )}

          <text
            x={effectiveX}
            y={effectiveY}
            fontSize={textElement.fontSize}
            fontFamily={textElement.fontFamily || "Arial, Helvetica, sans-serif"}
            fill={textElement.color || LBL}
            fontWeight={textElement.fontWeight || "normal"}
            fontStyle={textElement.fontStyle || "normal"}
            textDecoration={textElement.textDecoration || "none"}
            textAnchor={
              textElement.textAlign === "center"
                ? "middle"
                : textElement.textAlign === "right"
                ? "end"
                : "start"
            }
            dominantBaseline="middle"
            style={{
              pointerEvents: "auto",
              userSelect: "none",
              cursor: state.viewState.selectedTool === "eraser" ? "crosshair" : undefined,
            }}
            onMouseDown={(e) => {
              if (state.viewState.selectedTool === "eraser" && e.button === 0) {
                e.stopPropagation();
                dispatch({ type: "DELETE_TEXT_ELEMENT", payload: textElement.id });
              }
            }}
          >
            {textElement.text}
          </text>
        </g>
      );
    });
  }, [state.circuit.textElements, state.viewState.selectedTextElements, state.viewState.selectedTool, isDraggingTextElement, draggedTextElementId, textElementDragOffset]);

  // Complete text editing and add text element to circuit
  const completeTextEditing = () => {
    // Only complete if input is ready (prevents immediate blur)
    if (!isTextInputReady) {
      return;
    }

    let newTextElementId: string | null = null;
    if (textEditValue.trim()) {
      newTextElementId = generateId();
      const newTextElement = {
        id: newTextElementId,
        position: textEditCanvasPosition,
        text: textEditValue.trim(),
        fontSize: 14,
        color: "hsl(var(--foreground))",
        fontFamily: "Arial",
        fontWeight: "normal" as const,
        fontStyle: "normal" as const,
        textDecoration: "none" as const,
        textAlign: "left" as const,
      };
      dispatch({ type: "ADD_TEXT_ELEMENT", payload: newTextElement });
    }

    // Reset text editing state
    setIsEditingText(false);
    setTextEditValue("");
    setIsTextInputReady(false);

    // Auto-switch to select tool and select the newly created text
    if (newTextElementId) {
      dispatch({ type: "SET_TOOL", payload: "select" });
      // Select the newly created text element
      setTimeout(() => {
        dispatch({ type: "SELECT_TEXT_ELEMENTS", payload: [newTextElementId] });
        dispatch({ type: "SELECT_COMPONENTS", payload: [] });
      }, 50);
    }
  };

  // Handle text input key events
  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      completeTextEditing();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditingText(false);
      setTextEditValue("");
    }
  };

  // ── Scroll-to-zoom (cursor-centred, LTspice style) ──────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const { zoom, pan } = state.viewState;
      const delta = -e.deltaY * 0.001;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));

      // Zoom towards cursor position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) {
        dispatch({ type: "SET_ZOOM", payload: newZoom });
        return;
      }
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      // Keep the canvas-point under the cursor fixed
      const scale = newZoom / zoom;
      const newPanX = cx - scale * (cx - pan.x);
      const newPanY = cy - scale * (cy - pan.y);

      dispatch({ type: "SET_ZOOM", payload: newZoom });
      dispatch({ type: "SET_PAN", payload: { x: newPanX, y: newPanY } });
    },
    [state.viewState, dispatch],
  );

  return (
    <div
      ref={canvasRef}
      className={cn(
        "flex-1 overflow-hidden relative cursor-crosshair",
        state.viewState.selectedTool === "pan" && "cursor-grab",
        isDragging &&
          state.viewState.selectedTool === "pan" &&
          "cursor-grabbing",
        state.viewState.selectedTool === "select" && "cursor-default",
        state.viewState.selectedTool === "text" && "cursor-text",
        state.viewState.selectedTool === "eraser" && "cursor-crosshair",
        isDraggingComponent && "cursor-move",
        className
      )}
      style={{ background: "var(--canvas-bg)" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      >
        {/* ── World-space group: everything pans & zooms together ── */}
        <g transform={`translate(${state.viewState.pan.x},${state.viewState.pan.y}) scale(${state.viewState.zoom})`}>
          {/* Dot grid */}
          {renderGrid}

          {/* Analysis image overlay */}
          {state.analysisOverlay && showAnalysisOverlay && (() => {
            const ov = state.analysisOverlay;
            return (
              <g opacity={0.18}>
                {ov.originalImageUrl && (
                  <image
                    href={ov.originalImageUrl}
                    x={0}
                    y={0}
                    width={ov.imageSize.width}
                    height={ov.imageSize.height}
                    preserveAspectRatio="none"
                  />
                )}
                {ov.images.skeleton_png && (
                  <image
                    href={ov.images.skeleton_png}
                    x={0}
                    y={0}
                    width={ov.imageSize.width}
                    height={ov.imageSize.height}
                    preserveAspectRatio="none"
                    opacity={0.5}
                  />
                )}
              </g>
            );
          })()}

          {/* Analysis reference lines (dashed, behind editable wires) */}
          {state.analysisOverlay && showAnalysisOverlay && state.analysisOverlay.connections?.length > 0 && (
            <g opacity={0.25} style={{ pointerEvents: "none" }}>
              {state.analysisOverlay.connections.map((conn, i) => (
                <line
                  key={`conn-${i}`}
                  x1={conn.x1}
                  y1={conn.y1}
                  x2={conn.x2}
                  y2={conn.y2}
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                />
              ))}
            </g>
          )}

          {/* Wires + connection preview */}
          <g style={{ pointerEvents: "auto" }}>
            {renderWires}
            {renderJunctions}
            {renderConnectionPreview()}
          </g>

          {/* Components */}
          <g style={{ pointerEvents: "auto" }}>{renderComponents}</g>

          {/* Text Elements */}
          <g style={{ pointerEvents: "auto" }}>{renderTextElements}</g>
        </g>
      </svg>

      {/* Status bar (screen-space overlay) */}
      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm border border-border rounded-md px-3 py-1 text-xs text-muted-foreground font-mono">
        <div>Tool: {state.viewState.selectedTool}</div>
        <div>
          Pos: {Math.round(mousePosition.x)}, {Math.round(mousePosition.y)}
        </div>
        <div>Zoom: {Math.round(state.viewState.zoom * 100)}%</div>
      </div>

      {/* Analysis overlay toggle */}
      {state.analysisOverlay && (
        <div className="absolute top-3 right-3 flex gap-1.5 z-20">
          <button
            onClick={() => setShowAnalysisOverlay((v) => !v)}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-medium border transition-colors",
              showAnalysisOverlay
                ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
                : "bg-background/90 text-foreground border-border hover:bg-muted"
            )}
          >
            {showAnalysisOverlay ? "Hide" : "Show"} Reference
          </button>
          <button
            onClick={() => dispatch({ type: "CLEAR_ANALYSIS_OVERLAY" })}
            className="px-2.5 py-1 rounded text-[11px] font-medium border bg-background/90 text-muted-foreground border-border hover:bg-muted transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inline Text Input */}
      {isEditingText && (
        <input
          ref={textInputRef}
          type="text"
          value={textEditValue}
          onChange={(e) => setTextEditValue(e.target.value)}
          onKeyDown={handleTextInputKeyDown}
          onBlur={completeTextEditing}
          className="fixed border-2 border-blue-500 bg-transparent text-foreground px-2 py-1 text-sm outline-none z-50"
          style={{
            left: textEditPosition.x + "px",
            top: textEditPosition.y + "px",
            minWidth: "120px",
            fontSize: "14px",
            fontFamily: "inherit",
            backdropFilter: "blur(2px)",
          }}
          placeholder="Type text here..."
          autoFocus
        />
      )}

      {/* Probe Overlay */}
      <ProbeOverlay />
    </div>
  );
}
