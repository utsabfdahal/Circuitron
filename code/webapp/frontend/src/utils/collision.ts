import { Point, CircuitComponent } from "@/types/circuit";
import { GRID_SIZE } from "@/constants/components";

// Standard component dimensions (in canvas units)
export const COMPONENT_WIDTH = 40;
export const COMPONENT_HEIGHT = 20;
export const COMPONENT_PADDING = 5; // Minimum spacing between components

// Get the bounding box of a component
export function getComponentBounds(component: CircuitComponent): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const { x, y } = component.position;

  return {
    left: x - COMPONENT_WIDTH / 2,
    right: x + COMPONENT_WIDTH / 2,
    top: y - COMPONENT_HEIGHT / 2,
    bottom: y + COMPONENT_HEIGHT / 2,
  };
}

// Check if two component bounding boxes overlap (with padding)
export function doComponentsOverlap(
  component1: CircuitComponent,
  component2: CircuitComponent
): boolean {
  const bounds1 = getComponentBounds(component1);
  const bounds2 = getComponentBounds(component2);

  // Add padding to prevent components from being too close
  const padding = COMPONENT_PADDING;

  return !(
    bounds1.right + padding < bounds2.left ||
    bounds2.right + padding < bounds1.left ||
    bounds1.bottom + padding < bounds2.top ||
    bounds2.bottom + padding < bounds1.top
  );
}

// Check if a position would cause overlap with existing components
export function wouldPositionCauseOverlap(
  position: Point,
  existingComponents: CircuitComponent[],
  excludeComponentId?: string
): boolean {
  // Create a temporary component at the target position
  const tempComponent: CircuitComponent = {
    id: "temp",
    type: "resistor", // Type doesn't matter for collision detection
    position: { ...position, rotation: 0 },
    properties: {},
    terminals: [],
    label: "",
  };

  return existingComponents.some((component) => {
    // Skip the component being moved (for drag operations)
    if (excludeComponentId && component.id === excludeComponentId) {
      return false;
    }

    return doComponentsOverlap(tempComponent, component);
  });
}

// Find the nearest valid position that doesn't cause overlap
export function findNearestValidPosition(
  targetPosition: Point,
  existingComponents: CircuitComponent[],
  excludeComponentId?: string,
  snapToGrid: boolean = false
): Point {
  // If the target position is already valid, return it
  if (
    !wouldPositionCauseOverlap(
      targetPosition,
      existingComponents,
      excludeComponentId
    )
  ) {
    return snapToGrid
      ? {
          x: Math.round(targetPosition.x / GRID_SIZE) * GRID_SIZE,
          y: Math.round(targetPosition.y / GRID_SIZE) * GRID_SIZE,
        }
      : targetPosition;
  }

  // Search in expanding circles around the target position
  const maxSearchRadius = 200; // Maximum search distance
  const step = snapToGrid ? GRID_SIZE : 10; // Search step size

  for (let radius = step; radius <= maxSearchRadius; radius += step) {
    // Check positions in a circle around the target
    const positions: Point[] = [];

    if (snapToGrid) {
      // For grid mode, check grid positions in expanding squares
      for (let dx = -radius; dx <= radius; dx += GRID_SIZE) {
        for (let dy = -radius; dy <= radius; dy += GRID_SIZE) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            positions.push({
              x: Math.round((targetPosition.x + dx) / GRID_SIZE) * GRID_SIZE,
              y: Math.round((targetPosition.y + dy) / GRID_SIZE) * GRID_SIZE,
            });
          }
        }
      }
    } else {
      // For free positioning, check positions in a circle
      const numPoints = Math.max(8, Math.floor(radius / 5)); // More points for larger radius
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        positions.push({
          x: targetPosition.x + Math.cos(angle) * radius,
          y: targetPosition.y + Math.sin(angle) * radius,
        });
      }
    }

    // Check each position to see if it's valid
    for (const position of positions) {
      if (
        !wouldPositionCauseOverlap(
          position,
          existingComponents,
          excludeComponentId
        )
      ) {
        return position;
      }
    }
  }

  // If no valid position found, return the original position
  // This should rarely happen unless the canvas is completely full
  return targetPosition;
}

// Get a safe grid-aligned position for new component placement
export function getSafeGridPosition(
  preferredPosition: Point,
  existingComponents: CircuitComponent[]
): Point {
  // Always snap new components to grid for better organization
  const gridPosition = {
    x: Math.round(preferredPosition.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(preferredPosition.y / GRID_SIZE) * GRID_SIZE,
  };

  return findNearestValidPosition(
    gridPosition,
    existingComponents,
    undefined,
    true
  );
}
