"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Toolbar } from "./toolbar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar with Ctrl+B
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }

      // Close sidebar with Escape only on mobile (when sidebar is overlay)
      if (e.key === "Escape" && sidebarOpen) {
        // Only close sidebar on mobile/tablet where it's an overlay
        if (window.innerWidth < 1024) {
          // lg breakpoint
          e.preventDefault();
          closeSidebar();
        }
      }
    };

    if (mounted) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [mounted, sidebarOpen, toggleSidebar, closeSidebar]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <Header onMenuToggle={toggleSidebar} isMenuOpen={sidebarOpen} />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <Toolbar />

          {/* Canvas Area */}
          <main
            className={cn(
              "flex-1 overflow-hidden relative",
              sidebarOpen && "lg:ml-0" // Adjust for sidebar on larger screens
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
