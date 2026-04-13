import React, { useState } from "react";
import { cn } from "@/utils";

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = "bottom",
  delay = 500,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const sideClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-background",
    bottom:
      "bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-background",
    left: "left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-background",
    right:
      "right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-background",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            "absolute z-50 px-2 py-1 text-xs text-foreground bg-background border border-border rounded shadow-lg whitespace-nowrap",
            sideClasses[side],
            className
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn("absolute w-0 h-0 border-4", arrowClasses[side])}
          />
        </div>
      )}
    </div>
  );
}
