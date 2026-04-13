"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useCircuit } from "@/context/circuit-context";
import { COMPONENT_DEFINITIONS } from "@/constants/components";
import { CircuitComponent, TextElement } from "@/types/circuit";
import { formatValue } from "@/utils";
import { ComponentIcon } from "@/components/circuit/component-icons";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Type,
  Palette,
  Plus,
  Minus,
  Droplet,
} from "lucide-react";
import { cn } from "@/utils";

interface PropertiesPanelProps {
  className?: string;
}

export function PropertiesPanel({ className }: PropertiesPanelProps) {
  const { state, dispatch } = useCircuit();

  const selectedComponents = state.circuit.components.filter((comp) =>
    state.viewState.selectedComponents.includes(comp.id)
  );

  const selectedTextElements = state.circuit.textElements.filter((text) =>
    state.viewState.selectedTextElements.includes(text.id)
  );

  const handlePropertyChange = (
    componentId: string,
    property: string,
    value: string | number | boolean
  ) => {
    dispatch({
      type: "UPDATE_COMPONENT",
      payload: {
        id: componentId,
        updates: {
          properties: {
            ...state.circuit.components.find((c) => c.id === componentId)
              ?.properties,
            [property]: value,
          },
        },
      },
    });
  };

  const handleLabelChange = (componentId: string, label: string) => {
    dispatch({
      type: "UPDATE_COMPONENT",
      payload: {
        id: componentId,
        updates: { label },
      },
    });
  };

  const handlePositionChange = (
    componentId: string,
    axis: "x" | "y",
    value: number
  ) => {
    const component = state.circuit.components.find(
      (c) => c.id === componentId
    );
    if (!component) return;

    dispatch({
      type: "UPDATE_COMPONENT",
      payload: {
        id: componentId,
        updates: {
          position: {
            ...component.position,
            [axis]: value,
          },
        },
      },
    });
  };

  const handleRotationChange = (componentId: string, rotation: number) => {
    const component = state.circuit.components.find(
      (c) => c.id === componentId
    );
    if (!component) return;

    dispatch({
      type: "UPDATE_COMPONENT",
      payload: {
        id: componentId,
        updates: {
          position: {
            ...component.position,
            rotation: rotation % 360,
          },
        },
      },
    });
  };

  // Text element property handlers
  const handleTextPropertyChange = (
    textElementId: string,
    property: string,
    value: string | number
  ) => {
    dispatch({
      type: "UPDATE_TEXT_ELEMENT",
      payload: {
        id: textElementId,
        updates: {
          [property]: value,
        },
      },
    });
  };

  const handleTextContentChange = (textElementId: string, text: string) => {
    dispatch({
      type: "UPDATE_TEXT_ELEMENT",
      payload: {
        id: textElementId,
        updates: { text },
      },
    });
  };

  const handleTextPositionChange = (
    textElementId: string,
    axis: "x" | "y",
    value: number
  ) => {
    const textElement = state.circuit.textElements.find(
      (t) => t.id === textElementId
    );
    if (!textElement) return;

    dispatch({
      type: "UPDATE_TEXT_ELEMENT",
      payload: {
        id: textElementId,
        updates: {
          position: {
            ...textElement.position,
            [axis]: value,
          },
        },
      },
    });
  };

  const renderPropertyInput = (
    component: CircuitComponent,
    property: string,
    value: string | number | boolean
  ) => {
    if (typeof value === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) =>
            handlePropertyChange(
              component.id,
              property,
              parseFloat(e.target.value) || 0
            )
          }
          className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
          step="any"
        />
      );
    }

    if (typeof value === "string") {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) =>
            handlePropertyChange(component.id, property, e.target.value)
          }
          className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
        />
      );
    }

    if (typeof value === "boolean") {
      return (
        <input
          type="checkbox"
          checked={value}
          onChange={(e) =>
            handlePropertyChange(component.id, property, e.target.checked)
          }
          className="w-4 h-4 text-primary bg-background border-input rounded focus:ring-2 focus:ring-ring"
        />
      );
    }

    return (
      <span className="text-xs text-muted-foreground">{String(value)}</span>
    );
  };

  return (
    <div
      className={cn(
        "w-80 bg-background border-l border-border flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {selectedComponents.length === 0 &&
        selectedTextElements.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Select a component or text element to view its properties
          </div>
        ) : selectedComponents.length === 1 &&
          selectedTextElements.length === 0 ? (
          <div className="p-4 space-y-4">
            {selectedComponents.map((component) => {
              const componentDef = COMPONENT_DEFINITIONS[component.type];

              return (
                <div key={component.id} className="space-y-3">
                  {/* Component Type */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Type
                    </label>
                    <div className="text-sm text-foreground flex items-center gap-2">
                      <div className="w-5 h-5 flex-shrink-0">
                        <ComponentIcon type={component.type} size={16} />
                      </div>
                      {componentDef.name}
                    </div>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={component.label || ""}
                      onChange={(e) =>
                        handleLabelChange(component.id, e.target.value)
                      }
                      className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Component label"
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Position
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          X
                        </label>
                        <input
                          type="number"
                          value={Math.round(component.position.x)}
                          onChange={(e) =>
                            handlePositionChange(
                              component.id,
                              "x",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Y
                        </label>
                        <input
                          type="number"
                          value={Math.round(component.position.y)}
                          onChange={(e) =>
                            handlePositionChange(
                              component.id,
                              "y",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rotation */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Rotation (degrees)
                    </label>
                    <input
                      type="number"
                      value={component.position.rotation}
                      onChange={(e) =>
                        handleRotationChange(
                          component.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                      step={90}
                      min={0}
                      max={360}
                    />
                  </div>

                  {/* Component Scale (shrink / inflate) */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Scale
                    </label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const cur = component.symbolScale ?? 1;
                          const next = Math.max(0.3, +(cur - 0.1).toFixed(2));
                          dispatch({
                            type: "UPDATE_COMPONENT",
                            payload: {
                              id: component.id,
                              updates: { symbolScale: next },
                            },
                          });
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <input
                        type="range"
                        min={0.3}
                        max={3}
                        step={0.1}
                        value={component.symbolScale ?? 1}
                        onChange={(e) => {
                          dispatch({
                            type: "UPDATE_COMPONENT",
                            payload: {
                              id: component.id,
                              updates: { symbolScale: parseFloat(e.target.value) },
                            },
                          });
                        }}
                        className="flex-1 h-1.5 accent-primary"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const cur = component.symbolScale ?? 1;
                          const next = Math.min(3, +(cur + 0.1).toFixed(2));
                          dispatch({
                            type: "UPDATE_COMPONENT",
                            payload: {
                              id: component.id,
                              updates: { symbolScale: next },
                            },
                          });
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                        {((component.symbolScale ?? 1) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Component Properties */}
                  {Object.keys(component.properties).length > 0 && (() => {
                    const isAnalysisImport = "originalName" in component.properties;

                    // Separate analysis metadata from editable circuit properties
                    const META_KEYS = new Set(["originalName", "yoloConfidence", "detectedValue", "unit"]);
                    const PRIMARY_VALUE_KEYS: Record<string, string> = {
                      resistor: "resistance",
                      capacitor: "capacitance",
                      inductor: "inductance",
                      battery: "voltage",
                      led: "forwardVoltage",
                      diode: "forwardVoltage",
                      voltmeter: "resistance",
                      ammeter: "resistance",
                    };
                    const primaryKey = PRIMARY_VALUE_KEYS[component.type];
                    const circuitProps = Object.entries(component.properties).filter(
                      ([key]) => !META_KEYS.has(key) && key !== primaryKey
                    );

                    return (
                      <>
                        {/* Prominent value editing for analysis-imported components */}
                        {isAnalysisImport && (
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                            <label className="block text-xs font-semibold text-blue-400">
                              🔍 Detected Component
                            </label>
                            <div className="text-xs text-muted-foreground">
                              YOLO: <span className="text-foreground font-medium">{String(component.properties.originalName)}</span>
                              {component.properties.yoloConfidence != null && (
                                <span className="ml-2 text-green-500">{String(component.properties.yoloConfidence)}% conf</span>
                              )}
                            </div>
                            {component.properties.detectedValue && (
                              <div className="text-xs text-muted-foreground">
                                OCR Value: <span className="text-foreground font-medium">{String(component.properties.detectedValue)}</span>
                              </div>
                            )}

                            {/* Primary value (e.g. resistance, capacitance) */}
                            {primaryKey && component.properties[primaryKey] != null && (
                              <div className="pt-1">
                                <label className="block text-xs font-medium text-blue-300 mb-1 capitalize">
                                  {primaryKey}
                                  {component.properties.unit && (
                                    <span className="text-muted-foreground/70"> ({String(component.properties.unit)})</span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  value={component.properties[primaryKey] as number}
                                  onChange={(e) =>
                                    handlePropertyChange(
                                      component.id,
                                      primaryKey,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full px-2 py-1.5 text-sm font-medium bg-background border border-blue-500/40 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  step="any"
                                />
                                {typeof component.properties[primaryKey] === "number" &&
                                  component.properties.unit && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {formatValue(
                                        component.properties[primaryKey] as number,
                                        String(component.properties.unit)
                                      )}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Other properties */}
                        {(isAnalysisImport ? circuitProps : Object.entries(component.properties)).length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-2">
                              Properties
                            </label>
                            <div className="space-y-2">
                              {(isAnalysisImport ? circuitProps : Object.entries(component.properties)).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <label className="block text-xs text-muted-foreground mb-1 capitalize">
                                      {key.replace(/([A-Z])/g, " $1").trim()}
                                      {key !== "unit" &&
                                        component.properties.unit && (
                                          <span className="text-muted-foreground/70">
                                            {" "}
                                            ({component.properties.unit})
                                          </span>
                                        )}
                                    </label>
                                    {renderPropertyInput(component, key, value)}
                                    {typeof value === "number" &&
                                      component.properties.unit &&
                                      key !== "unit" && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {formatValue(
                                            value,
                                            String(component.properties.unit)
                                          )}
                                        </div>
                                      )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Terminals */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-2">
                      Terminals
                    </label>
                    <div className="space-y-1">
                      {component.terminals.map((terminal, index) => (
                        <div
                          key={terminal.id}
                          className="text-xs text-muted-foreground"
                        >
                          Terminal {index + 1}: {terminal.type}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : selectedComponents.length > 1 &&
          selectedTextElements.length === 0 ? (
          <div className="p-4">
            <div className="text-sm text-foreground mb-3">
              Multiple components selected ({selectedComponents.length})
            </div>
            <div className="space-y-2">
              {selectedComponents.map((component) => {
                const componentDef = COMPONENT_DEFINITIONS[component.type];
                return (
                  <div
                    key={component.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div className="w-4 h-4 flex-shrink-0">
                      <ComponentIcon type={component.type} size={14} />
                    </div>
                    <span>{component.label || componentDef.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  selectedComponents.forEach((comp) => {
                    dispatch({ type: "DELETE_COMPONENT", payload: comp.id });
                  });
                }}
                className="w-full"
              >
                Delete Selected
              </Button>
            </div>
          </div>
        ) : selectedTextElements.length === 1 &&
          selectedComponents.length === 0 ? (
          <div className="p-4 space-y-4">
            {selectedTextElements.map((textElement) => (
              <div key={textElement.id} className="space-y-3">
                {/* Text Element Type */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Type
                  </label>
                  <div className="text-sm text-foreground">📝 Text Element</div>
                </div>

                {/* Text Content */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Text Content
                  </label>
                  <textarea
                    value={textElement.text}
                    onChange={(e) =>
                      handleTextContentChange(textElement.id, e.target.value)
                    }
                    className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={2}
                    placeholder="Enter text..."
                  />
                </div>

                {/* Font Family, Size & Color */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Font Family, Size & Color
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Font Family */}
                    <select
                      value={textElement.fontFamily || "Arial"}
                      onChange={(e) =>
                        handleTextPropertyChange(
                          textElement.id,
                          "fontFamily",
                          e.target.value
                        )
                      }
                      className="flex-1 px-2 py-1 text-xs bg-background text-foreground border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      style={{
                        backgroundColor: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      <option
                        value="Arial"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Arial
                      </option>
                      <option
                        value="Helvetica"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Helvetica
                      </option>
                      <option
                        value="Times New Roman"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Times New Roman
                      </option>
                      <option
                        value="Georgia"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Georgia
                      </option>
                      <option
                        value="Verdana"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Verdana
                      </option>
                      <option
                        value="Tahoma"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Tahoma
                      </option>
                      <option
                        value="Trebuchet MS"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Trebuchet MS
                      </option>
                      <option
                        value="Courier New"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Courier New
                      </option>
                      <option
                        value="Monaco"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Monaco
                      </option>
                      <option
                        value="Consolas"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Consolas
                      </option>
                      <option
                        value="system-ui"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        System UI
                      </option>
                      <option
                        value="Inter"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Inter
                      </option>
                      <option
                        value="Roboto"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Roboto
                      </option>
                      <option
                        value="Open Sans"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Open Sans
                      </option>
                      <option
                        value="Lato"
                        style={{
                          backgroundColor: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        Lato
                      </option>
                    </select>

                    {/* Font Size */}
                    <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
                      <button
                        onClick={() =>
                          handleTextPropertyChange(
                            textElement.id,
                            "fontSize",
                            Math.max(8, textElement.fontSize - 1)
                          )
                        }
                        className="flex items-center justify-center w-6 h-6 rounded border border-input hover:bg-background transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>

                      <input
                        type="text"
                        value={textElement.fontSize}
                        onChange={(e) =>
                          handleTextPropertyChange(
                            textElement.id,
                            "fontSize",
                            parseInt(e.target.value) || 14
                          )
                        }
                        className="w-12 px-1 py-1 text-xs bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-center font-medium"
                        placeholder="14"
                      />

                      <button
                        onClick={() =>
                          handleTextPropertyChange(
                            textElement.id,
                            "fontSize",
                            Math.min(72, textElement.fontSize + 1)
                          )
                        }
                        className="flex items-center justify-center w-6 h-6 rounded border border-input hover:bg-background transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Color Picker */}
                    <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
                      <div className="relative border border-input rounded">
                        <input
                          type="color"
                          value={textElement.color || "#000000"}
                          onChange={(e) =>
                            handleTextPropertyChange(
                              textElement.id,
                              "color",
                              e.target.value
                            )
                          }
                          className="w-6 h-6 rounded cursor-pointer"
                          style={{
                            WebkitAppearance: "none",
                            outline: "none",
                            border: "none",
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Palette className="h-3 w-3 text-foreground/70" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Formatting */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Formatting & Alignment
                  </label>
                  <div className="space-y-2">
                    {/* Text Formatting Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Style
                      </span>
                      <div className="flex gap-1 p-1 bg-muted rounded-md">
                        <button
                          onClick={() =>
                            handleTextPropertyChange(
                              textElement.id,
                              "fontWeight",
                              textElement.fontWeight === "bold"
                                ? "normal"
                                : "bold"
                            )
                          }
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded border border-input transition-all duration-200 font-bold",
                            textElement.fontWeight === "bold"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-transparent hover:bg-background hover:shadow-sm"
                          )}
                        >
                          <Bold className="h-3 w-3" />
                        </button>

                        <button
                          onClick={() =>
                            handleTextPropertyChange(
                              textElement.id,
                              "fontStyle",
                              textElement.fontStyle === "italic"
                                ? "normal"
                                : "italic"
                            )
                          }
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded border border-input transition-all duration-200",
                            textElement.fontStyle === "italic"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-transparent hover:bg-background hover:shadow-sm"
                          )}
                        >
                          <Italic className="h-3 w-3" />
                        </button>

                        <button
                          onClick={() =>
                            handleTextPropertyChange(
                              textElement.id,
                              "textDecoration",
                              textElement.textDecoration === "underline"
                                ? "none"
                                : "underline"
                            )
                          }
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded border border-input transition-all duration-200",
                            textElement.textDecoration === "underline"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-transparent hover:bg-background hover:shadow-sm"
                          )}
                        >
                          <Underline className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Text Alignment Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Align
                      </span>
                      <div className="flex gap-1 p-1 bg-muted rounded-md">
                        <button
                          onClick={() =>
                            handleTextPropertyChange(
                              textElement.id,
                              "textAlign",
                              "left"
                            )
                          }
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded border border-input transition-all duration-200",
                            textElement.textAlign === "left"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-transparent hover:bg-background hover:shadow-sm"
                          )}
                        >
                          <AlignLeft className="h-3 w-3" />
                        </button>

                        <button
                          onClick={() =>
                            handleTextPropertyChange(
                              textElement.id,
                              "textAlign",
                              "center"
                            )
                          }
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded border border-input transition-all duration-200",
                            textElement.textAlign === "center"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-transparent hover:bg-background hover:shadow-sm"
                          )}
                        >
                          <AlignCenter className="h-3 w-3" />
                        </button>

                        <button
                          onClick={() =>
                            handleTextPropertyChange(
                              textElement.id,
                              "textAlign",
                              "right"
                            )
                          }
                          className={cn(
                            "flex items-center justify-center w-6 h-6 rounded border border-input transition-all duration-200",
                            textElement.textAlign === "right"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-transparent hover:bg-background hover:shadow-sm"
                          )}
                        >
                          <AlignRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Position
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="number"
                        placeholder="X"
                        value={Math.round(textElement.position.x)}
                        onChange={(e) =>
                          handleTextPositionChange(
                            textElement.id,
                            "x",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Y"
                        value={Math.round(textElement.position.y)}
                        onChange={(e) =>
                          handleTextPositionChange(
                            textElement.id,
                            "y",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : selectedTextElements.length > 1 &&
          selectedComponents.length === 0 ? (
          <div className="p-4">
            <div className="text-sm text-foreground mb-3">
              Multiple text elements selected ({selectedTextElements.length})
            </div>
            <div className="space-y-2">
              {selectedTextElements.map((textElement) => (
                <div
                  key={textElement.id}
                  className="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <span className="text-sm truncate">
                    📝 &quot;{textElement.text.substring(0, 20)}
                    {textElement.text.length > 20 ? "..." : ""}&quot;
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button
                variant="destructive"
                onClick={() => {
                  selectedTextElements.forEach((textElement) => {
                    dispatch({
                      type: "DELETE_TEXT_ELEMENT",
                      payload: textElement.id,
                    });
                  });
                  dispatch({ type: "SELECT_TEXT_ELEMENTS", payload: [] });
                }}
                size="sm"
                className="w-full"
              >
                Delete Selected
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-sm text-foreground mb-3">
              Mixed selection: {selectedComponents.length} components,{" "}
              {selectedTextElements.length} text elements
            </div>
            <div className="text-xs text-muted-foreground">
              Select only components or only text elements to edit properties
            </div>
            <div className="mt-4 space-y-2">
              {selectedComponents.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    selectedComponents.forEach((component) => {
                      dispatch({
                        type: "DELETE_COMPONENT",
                        payload: component.id,
                      });
                    });
                    dispatch({ type: "SELECT_COMPONENTS", payload: [] });
                  }}
                  size="sm"
                  className="w-full"
                >
                  Delete Selected Components
                </Button>
              )}
              {selectedTextElements.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    selectedTextElements.forEach((textElement) => {
                      dispatch({
                        type: "DELETE_TEXT_ELEMENT",
                        payload: textElement.id,
                      });
                    });
                    dispatch({ type: "SELECT_TEXT_ELEMENTS", payload: [] });
                  }}
                  size="sm"
                  className="w-full"
                >
                  Delete Selected Text Elements
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
