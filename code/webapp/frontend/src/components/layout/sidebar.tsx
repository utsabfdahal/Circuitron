"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useCircuit } from "@/context/circuit-context";
import {
  COMPONENT_DEFINITIONS,
  COMPONENT_CATEGORIES,
} from "@/constants/components";
import { ComponentType } from "@/types/circuit";
import { ComponentIcon } from "@/components/circuit/component-icons";
import { cn } from "@/utils";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Grid3X3,
  ZapOff,
  Check,
  Square,
  CheckSquare,
  MinusSquare,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { state, dispatch } = useCircuit();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "passive",
    "active",
    "transistor",
  ]);
  const [draggedComponent, setDraggedComponent] =
    useState<ComponentType | null>(null);

  // Track which components are enabled (visible in palette)
  const allComponentTypes = useMemo(
    () => Object.keys(COMPONENT_DEFINITIONS) as ComponentType[],
    []
  );
  const [enabledComponents, setEnabledComponents] = useState<Set<ComponentType>>(
    () => new Set(allComponentTypes)
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleComponentEnabled = (type: ComponentType) => {
    setEnabledComponents((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleCategoryEnabled = (category: string) => {
    const categoryComponents = Object.values(COMPONENT_DEFINITIONS).filter(
      (c) => c.category === category
    );
    const allEnabled = categoryComponents.every((c) =>
      enabledComponents.has(c.type)
    );

    setEnabledComponents((prev) => {
      const next = new Set(prev);
      for (const comp of categoryComponents) {
        if (allEnabled) {
          next.delete(comp.type);
        } else {
          next.add(comp.type);
        }
      }
      return next;
    });
  };

  // All components for the category view (including disabled ones for checkboxes)
  const allComponentsByCategory = Object.values(COMPONENT_DEFINITIONS)
    .filter(
      (comp) =>
        comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .reduce((acc, comp) => {
      if (!acc[comp.category]) {
        acc[comp.category] = [];
      }
      acc[comp.category].push(comp);
      return acc;
    }, {} as Record<string, (typeof COMPONENT_DEFINITIONS)[ComponentType][]>);

  const handleDragStart = (
    e: React.DragEvent,
    componentType: ComponentType
  ) => {
    setDraggedComponent(componentType);
    e.dataTransfer.setData("componentType", componentType);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleToggleGrid = () => {
    dispatch({ type: "TOGGLE_GRID" });
  };

  const handleToggleSnap = () => {
    dispatch({ type: "TOGGLE_SNAP_TO_GRID" });
  };

  // Get category checkbox state: all, none, or partial
  const getCategoryState = (
    category: string
  ): "all" | "none" | "partial" => {
    const categoryComponents = Object.values(COMPONENT_DEFINITIONS).filter(
      (c) => c.category === category
    );
    const enabledCount = categoryComponents.filter((c) =>
      enabledComponents.has(c.type)
    ).length;
    if (enabledCount === 0) return "none";
    if (enabledCount === categoryComponents.length) return "all";
    return "partial";
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-80 bg-background border-r border-border z-50 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:top-0 lg:h-[calc(100vh-3.5rem)]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* View Options */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Tooltip content="Toggle grid visibility (G)" side="top">
                <Button
                  variant={state.viewState.gridVisible ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleGrid}
                  className="flex-1"
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  Grid
                </Button>
              </Tooltip>
              <Tooltip content="Toggle snap to grid" side="top">
                <Button
                  variant={state.viewState.snapToGrid ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleSnap}
                  className="flex-1"
                >
                  <ZapOff className="h-4 w-4 mr-1" />
                  Snap
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Components */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Components
              </h3>

              {Object.entries(allComponentsByCategory).map(
                ([category, components]) => {
                  const catState = getCategoryState(category);

                  return (
                    <div key={category} className="mb-4">
                      <div className="flex items-center gap-1 mb-2">
                        {/* Category checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategoryEnabled(category);
                          }}
                          className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
                          title={
                            catState === "all"
                              ? "Deselect all in category"
                              : "Select all in category"
                          }
                        >
                          {catState === "all" ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : catState === "partial" ? (
                            <MinusSquare className="h-4 w-4 text-primary/60" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>

                        {/* Category header */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="flex items-center gap-1.5 flex-1 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {expandedCategories.includes(category) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {
                            COMPONENT_CATEGORIES[
                              category as keyof typeof COMPONENT_CATEGORIES
                            ]
                          }
                          <span className="text-xs text-muted-foreground ml-auto">
                            {components.filter((c) =>
                              enabledComponents.has(c.type)
                            ).length}
                            /{components.length}
                          </span>
                        </button>
                      </div>

                      {expandedCategories.includes(category) && (
                        <div className="ml-6 space-y-1">
                          {components.map((component) => {
                            const isEnabled = enabledComponents.has(
                              component.type
                            );

                            return (
                              <div
                                key={component.type}
                                draggable={isEnabled}
                                onDragStart={(e) => {
                                  if (isEnabled) {
                                    handleDragStart(e, component.type);
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-md transition-colors",
                                  isEnabled
                                    ? "cursor-move hover:bg-accent hover:text-accent-foreground"
                                    : "opacity-40 cursor-default",
                                  draggedComponent === component.type &&
                                    "bg-accent"
                                )}
                              >
                                {/* Component checkbox */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleComponentEnabled(component.type);
                                  }}
                                  className="flex items-center justify-center w-4 h-4 flex-shrink-0"
                                >
                                  {isEnabled ? (
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <Square className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </button>

                                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                  <ComponentIcon
                                    type={component.type}
                                    size={18}
                                  />
                                </div>
                                <span className="text-sm">
                                  {component.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
              )}

              {Object.keys(allComponentsByCategory).length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No components found
                </div>
              )}
            </div>
          </div>

          {/* Circuit Info */}
          <div className="p-4 border-t border-border bg-muted/20">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Components: {state.circuit.components.length}</div>
              <div>Wires: {state.circuit.wires.length}</div>
              <div>Tool: {state.viewState.selectedTool}</div>
              <div>Zoom: {Math.round(state.viewState.zoom * 100)}%</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
