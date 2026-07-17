/**
 * SimplePathfinder - Bulletproof pathfinding that always works
 *
 * Strategy: Keep it simple and always return a valid path
 * 1. Try direct path - if clear, use it
 * 2. If blocked, try simple detour around obstacle
 * 3. Always fallback to direct path if complex routing fails
 */

import * as turf from '@turf/turf';
import { BuildingIndex } from './BuildingExtractor';

export class SimplePathfinder {
  private buildingIndex: BuildingIndex | null = null;

  /**
   * Set building index for collision detection
   */
  setBuildingIndex(index: BuildingIndex): void {
    this.buildingIndex = index;
  }

  /**
   * Find a path from start to goal
   * ALWAYS returns a valid path (never fails)
   */
  findPath(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    // Always return at least start and goal
    if (!this.buildingIndex) {
      return [start, goal];
    }

    // Check if direct path is clear
    const directBlocked = this.isLineBlocked(start, goal);

    if (!directBlocked) {
      // Direct path is clear!
      return [start, goal];
    }

    // Path is blocked, try simple detour
    const detourPath = this.trySimpleDetour(start, goal);

    if (detourPath) {
      return detourPath;
    }

    // Fallback: return direct path anyway
    // Better to move through obstacles than not move at all
    console.warn('No clear path found, using direct line');
    return [start, goal];
  }

  /**
   * Try a simple detour around obstacles
   */
  private trySimpleDetour(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] | null {
    // Calculate perpendicular offsets (left and right of direct line)
    const dx = goal[0] - start[0];
    const dy = goal[1] - start[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.00001) return null; // Too close

    // Perpendicular vector (rotated 90 degrees)
    const perpX = -dy / dist;
    const perpY = dx / dist;

    // Try offsets at different distances
    const offsets = [0.0001, 0.0002, 0.0003]; // ~10m, ~20m, ~30m

    for (const offset of offsets) {
      // Try left side
      const leftWaypoint: [number, number] = [
        start[0] + dx * 0.5 + perpX * offset,
        start[1] + dy * 0.5 + perpY * offset,
      ];

      if (!this.isLineBlocked(start, leftWaypoint) && !this.isLineBlocked(leftWaypoint, goal)) {
        return [start, leftWaypoint, goal];
      }

      // Try right side
      const rightWaypoint: [number, number] = [
        start[0] + dx * 0.5 - perpX * offset,
        start[1] + dy * 0.5 - perpY * offset,
      ];

      if (!this.isLineBlocked(start, rightWaypoint) && !this.isLineBlocked(rightWaypoint, goal)) {
        return [start, rightWaypoint, goal];
      }
    }

    return null;
  }

  /**
   * Check if a straight line is blocked by buildings
   */
  private isLineBlocked(
    from: [number, number],
    to: [number, number]
  ): boolean {
    if (!this.buildingIndex) return false;

    // Get buildings in cells along the line
    const cells = this.getCellsAlongLine(from, to);
    const potentialBuildings = new Set<string>();

    for (const cellKey of cells) {
      const buildingIds = this.buildingIndex.spatialGrid.get(cellKey) || [];
      buildingIds.forEach(id => potentialBuildings.add(id));
    }

    // Quick bounding box check
    const lineMinLng = Math.min(from[0], to[0]);
    const lineMaxLng = Math.max(from[0], to[0]);
    const lineMinLat = Math.min(from[1], to[1]);
    const lineMaxLat = Math.max(from[1], to[1]);

    // Check only first 20 buildings for performance
    let checkCount = 0;
    const MAX_CHECKS = 20;

    for (const buildingId of Array.from(potentialBuildings)) {
      if (checkCount++ > MAX_CHECKS) {
        // Too many buildings, assume blocked to be safe
        return true;
      }

      const building = this.buildingIndex.buildings.get(buildingId);
      if (!building) continue;

      // Quick bounds check
      const { bounds } = building;
      if (
        lineMaxLng < bounds.minLng ||
        lineMinLng > bounds.maxLng ||
        lineMaxLat < bounds.minLat ||
        lineMinLat > bounds.maxLat
      ) {
        continue;
      }

      // Detailed intersection check
      try {
        const line = turf.lineString([from, to]);
        const polygon = turf.polygon(building.coordinates);

        if (turf.booleanIntersects(line, polygon)) {
          return true; // Blocked!
        }
      } catch {
        // If check fails, assume blocked to be safe
        return true;
      }
    }

    return false; // Not blocked
  }

  /**
   * Get grid cells along a line (Bresenham-like)
   */
  private getCellsAlongLine(
    from: [number, number],
    to: [number, number]
  ): string[] {
    if (!this.buildingIndex) return [];

    const { gridSize } = this.buildingIndex;
    const cells = new Set<string>();

    const x0 = Math.floor(from[0] / gridSize);
    const y0 = Math.floor(from[1] / gridSize);
    const x1 = Math.floor(to[0] / gridSize);
    const y1 = Math.floor(to[1] / gridSize);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;
    let x = x0;
    let y = y0;

    // Limit iterations to prevent infinite loop
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    while (iterations++ < MAX_ITERATIONS) {
      cells.add(`${x},${y}`);

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;

      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }

      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return Array.from(cells);
  }
}
