import React from "react";
import { ComponentType } from "@/types/circuit";
import {
  KicadSymbolRenderer,
  hasKicadSymbol,
} from "@/components/circuit/kicad-symbol-renderer";

interface ComponentIconProps {
  type: ComponentType;
  size?: number;
  className?: string;
}

export const ComponentIcon: React.FC<ComponentIconProps> = ({
  type,
  size = 24,
  className = "",
}) => {
  const iconProps = { width: size, height: size, className };

  // Use KiCad symbol if available (analog/passive components)
  if (hasKicadSymbol(type)) {
    return <KicadSymbolRenderer type={type} size={size} color="currentColor" />;
  }

  // Fallback to hand-drawn SVGs for logic gates and unsupported types
  switch (type) {
    case "and_gate":
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <line
            x1="10"
            y1="20"
            x2="30"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="10"
            y1="40"
            x2="30"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="30"
            y="15"
            width="20"
            height="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 50 15 Q 60 30 50 45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="60"
            y1="30"
            x2="90"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "or_gate":
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <line
            x1="10"
            y1="20"
            x2="30"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="10"
            y1="40"
            x2="30"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 30 15 Q 40 30 30 45 L 45 45 Q 60 30 45 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="60"
            y1="30"
            x2="90"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "not_gate":
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <line
            x1="10"
            y1="30"
            x2="30"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
          <polygon
            points="30,20 30,40 50,30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="55"
            cy="30"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="60"
            y1="30"
            x2="90"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "nand_gate":
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <line
            x1="10"
            y1="20"
            x2="30"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="10"
            y1="40"
            x2="30"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="30"
            y="15"
            width="15"
            height="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 45 15 Q 50 30 45 45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="55"
            cy="30"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="60"
            y1="30"
            x2="90"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "nor_gate":
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <line
            x1="10"
            y1="20"
            x2="30"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="10"
            y1="40"
            x2="30"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 30 15 Q 40 30 30 45 L 43 45 Q 55 30 43 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="60"
            cy="30"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="65"
            y1="30"
            x2="90"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "xor_gate":
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <line
            x1="10"
            y1="20"
            x2="28"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="10"
            y1="40"
            x2="28"
            y2="40"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 28 15 Q 37 30 28 45 L 45 45 Q 58 30 45 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 32 15 Q 40 30 32 45"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="60"
            y1="30"
            x2="90"
            y2="30"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    default:
      return (
        <svg
          viewBox="0 0 100 60"
          xmlns="http://www.w3.org/2000/svg"
          {...iconProps}
        >
          <rect
            x="25"
            y="20"
            width="50"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <text
            x="50"
            y="35"
            textAnchor="middle"
            fontSize="12"
            fill="currentColor"
          >
            ?
          </text>
        </svg>
      );
  }
};
