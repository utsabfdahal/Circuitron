import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function snapToGrid(value: number, gridSize: number = 10): number {
  return Math.round(value / gridSize) * gridSize;
}

export function calculateDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function formatValue(value: number, unit: string): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}G${unit}`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M${unit}`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}k${unit}`;
  if (value >= 1) return `${value.toFixed(2)}${unit}`;
  if (value >= 1e-3) return `${(value * 1e3).toFixed(2)}m${unit}`;
  if (value >= 1e-6) return `${(value * 1e6).toFixed(2)}μ${unit}`;
  if (value >= 1e-9) return `${(value * 1e9).toFixed(2)}n${unit}`;
  return `${value.toFixed(2)}${unit}`;
}

// Re-export netlist generation utilities
export {
  AdvancedNetlistGenerator,
  NetlistValidator,
  netlistGenerator,
} from "./netlist-generator";

// Re-export circuit validation utilities
export {
  CircuitValidator,
  circuitValidator,
  type ValidationIssue,
} from "./circuit-validator";
