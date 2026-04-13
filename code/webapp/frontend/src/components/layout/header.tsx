"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useTheme } from "@/context/theme-context";
import { useCircuit } from "@/context/circuit-context";
import Link from "next/link";
import {
  Sun,
  Moon,
  Menu,
  Save,
  FolderOpen,
  FileText,
  Undo2,
  Redo2,
  Settings,
  Zap,
  ScanSearch,
} from "lucide-react";

interface HeaderProps {
  onMenuToggle: () => void;
  isMenuOpen: boolean;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { state, dispatch } = useCircuit();

  const handleUndo = () => {
    dispatch({ type: "UNDO" });
  };

  const handleRedo = () => {
    dispatch({ type: "REDO" });
  };

  const handleNew = () => {
    dispatch({ type: "CLEAR_CIRCUIT" });
  };

  const handleSave = () => {
    // Feature not implemented yet
    // TODO: Implement save functionality in future version
  };

  const handleLoad = () => {
    // Feature not implemented yet
    // TODO: Implement load functionality in future version
  };

  return (
    <header className="bg-background border-b border-border h-14 flex items-center justify-between px-4 sticky top-0 z-50">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        <Tooltip content="Toggle sidebar" side="bottom">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </Tooltip>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Circuitron</h1>
          </div>

          <div className="hidden sm:flex items-center gap-1 ml-4">
            <Tooltip content="New circuit (Ctrl+N)" side="bottom">
              <Button variant="ghost" size="sm" onClick={handleNew}>
                <FileText className="h-4 w-4 mr-1" />
                New
              </Button>
            </Tooltip>
            <Tooltip content="Open circuit (Ctrl+O)" side="bottom">
              <Button variant="ghost" size="sm" onClick={handleLoad}>
                <FolderOpen className="h-4 w-4 mr-1" />
                Open
              </Button>
            </Tooltip>
            <Tooltip content="Save circuit (Ctrl+S)" side="bottom">
              <Button variant="ghost" size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </Tooltip>
            <Tooltip content="Analyze circuit image" side="bottom">
              <Link href="/analyze">
                <Button variant="ghost" size="sm">
                  <ScanSearch className="h-4 w-4 mr-1" />
                  Analyze Image
                </Button>
              </Link>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Center Section - Circuit Name */}
      <div className="hidden md:flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {state.circuit.name}
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Undo (Ctrl+Z)" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUndo}
              disabled={state.undoStack.length === 0}
              className="h-8 w-8"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Y)" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRedo}
              disabled={state.redoStack.length === 0}
              className="h-8 w-8"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1">
          <Tooltip content="Settings" side="bottom">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        <Tooltip
          content={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
          side="bottom"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
