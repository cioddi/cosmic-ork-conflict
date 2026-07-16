/**
 * GridPathfinder - Fast grid-based pathfinding with building avoidance
 *
 * Strategy:
 * 1. Create a uniform grid over the map area
 * 2. Mark grid cells as blocked/walkable based on buildings
 * 3. Use optimized A* pathfinding on the grid
 * 4. Convert grid path back to map coordinates
 *
 * Benefits:
 * - Well-tested A* algorithm on uniform grid
 * - Fast lookups (no polygon intersection tests during pathfinding)
 * - Can be GPU-accelerated later using WebGPU
 */

import * as turf from '@turf/turf';
import { BuildingIndex } from './BuildingExtractor';

export interface GridConfig {
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  cellSize: number; // Size of each grid cell in meters
}

export interface GridCell {
  x: number;
  y: number;
  walkable: boolean;
  lng: number; // Center longitude
  lat: number; // Center latitude
}

export class GridPathfinder {
  private grid: Uint8Array; // 0 = blocked, 1 = walkable
  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private bounds: [number, number, number, number];
  private cellSizeDegrees: number = 0;
  private cellSizeMeters: number;

  constructor(config: GridConfig) {
    this.bounds = config.bounds;
    this.cellSizeMeters = config.cellSize;
    this.cellSizeDegrees = this.metersToDegrees(config.cellSize, this.bounds[1]);

    // Calculate grid dimensions
    const lngRange = this.bounds[2] - this.bounds[0];
    const latRange = this.bounds[3] - this.bounds[1];

    this.gridWidth = Math.ceil(lngRange / this.cellSizeDegrees);
    this.gridHeight = Math.ceil(latRange / this.cellSizeDegrees);

    console.log(`Creating grid: ${this.gridWidth}x${this.gridHeight} = ${this.gridWidth * this.gridHeight} cells`);

    // Initialize all cells as walkable
    this.grid = new Uint8Array(this.gridWidth * this.gridHeight);
    this.grid.fill(1); // All walkable initially
  }

  /**
   * Mark grid cells as blocked based on building index
   */
  setBuildingIndex(buildingIndex: BuildingIndex): void {
    console.log('Marking grid cells with buildings...');
    let blockedCount = 0;

    // Iterate through all buildings
    for (const building of Array.from(buildingIndex.buildings.values())) {
      // Get grid cells that overlap this building's bounds
      const minX = this.lngToGridX(building.bounds.minLng);
      const maxX = this.lngToGridX(building.bounds.maxLng);
      const minY = this.latToGridY(building.bounds.minLat);
      const maxY = this.latToGridY(building.bounds.maxLat);

      // Mark all cells in this range
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          if (this.isInBounds(x, y)) {
            // Check if cell center is actually inside the building polygon
            const cellLng = this.gridXToLng(x);
            const cellLat = this.gridYToLat(y);

            try {
              const point = turf.point([cellLng, cellLat]);
              const polygon = turf.polygon(building.coordinates);

              if (turf.booleanPointInPolygon(point, polygon)) {
                const index = y * this.gridWidth + x;
                if (this.grid[index] === 1) {
                  this.grid[index] = 0; // Mark as blocked
                  blockedCount++;
                }
              }
            } catch {
              // If check fails, mark as blocked to be safe
              const index = y * this.gridWidth + x;
              if (this.grid[index] === 1) {
                this.grid[index] = 0;
                blockedCount++;
              }
            }
          }
        }
      }
    }

    const totalCells = this.gridWidth * this.gridHeight;
    const walkableCount = totalCells - blockedCount;
    const blockedPercent = ((blockedCount / totalCells) * 100).toFixed(1);

    console.log(`Grid initialized: ${walkableCount} walkable, ${blockedCount} blocked (${blockedPercent}%)`);
  }

  /**
   * Find path from start to goal using A* on the grid
   */
  findPath(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    // Convert to grid coordinates
    const startX = this.lngToGridX(start[0]);
    const startY = this.latToGridY(start[1]);
    const goalX = this.lngToGridX(goal[0]);
    const goalY = this.latToGridY(goal[1]);

    // Check if start or goal is out of bounds
    if (!this.isInBounds(startX, startY) || !this.isInBounds(goalX, goalY)) {
      console.warn('Start or goal out of grid bounds');
      return [start, goal];
    }

    // Run A* on the grid
    const gridPath = this.aStarSearch(startX, startY, goalX, goalY);

    if (!gridPath || gridPath.length === 0) {
      console.log('No grid path found');
      return [start, goal];
    }

    // Convert grid path back to lat/lng coordinates
    const latLngPath: [number, number][] = gridPath.map(cell => [
      this.gridXToLng(cell.x),
      this.gridYToLat(cell.y)
    ]);

    // Simplify path to remove unnecessary waypoints
    const simplified = this.simplifyPath(latLngPath);

    console.log(`Grid pathfinding: ${gridPath.length} cells -> ${simplified.length} waypoints`);

    return simplified;
  }

  /**
   * A* search on the grid (8-directional movement)
   */
  private aStarSearch(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number
  ): { x: number; y: number }[] | null {
    interface PathNode {
      x: number;
      y: number;
      g: number; // Cost from start
      h: number; // Heuristic to goal
      f: number; // Total cost
      parent: PathNode | null;
    }

    const openSet = new Map<string, PathNode>();
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, goalX, goalY),
      f: 0,
      parent: null
    };
    startNode.f = startNode.h;

    openSet.set(`${startX},${startY}`, startNode);

    const MAX_ITERATIONS = 10000;
    let iterations = 0;

    while (openSet.size > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Get node with lowest f score
      let current: PathNode | null = null;
      let lowestF = Infinity;

      for (const node of Array.from(openSet.values())) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
        }
      }

      if (!current) break;

      // Check if we reached the goal
      if (current.x === goalX && current.y === goalY) {
        return this.reconstructGridPath(current);
      }

      const currentKey = `${current.x},${current.y}`;
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Check all 8 neighbors
      const neighbors = this.getNeighbors(current.x, current.y);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (closedSet.has(neighborKey)) {
          continue;
        }

        // Calculate cost (diagonal = 1.414, straight = 1)
        const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;
        const moveCost = isDiagonal ? 1.414 : 1.0;
        const g = current.g + moveCost;

        const existingNode = openSet.get(neighborKey);

        if (!existingNode || g < existingNode.g) {
          const h = this.heuristic(neighbor.x, neighbor.y, goalX, goalY);
          const newNode: PathNode = {
            x: neighbor.x,
            y: neighbor.y,
            g,
            h,
            f: g + h,
            parent: current
          };

          openSet.set(neighborKey, newNode);
        }
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn('A* hit max iterations');
    }

    // No path found
    return null;
  }

  /**
   * Get walkable neighbors for a grid cell (8-directional)
   */
  private getNeighbors(x: number, y: number): { x: number; y: number }[] {
    const neighbors: { x: number; y: number }[] = [];

    // 8 directions: N, NE, E, SE, S, SW, W, NW
    const directions = [
      { dx: 0, dy: -1 },  // N
      { dx: 1, dy: -1 },  // NE
      { dx: 1, dy: 0 },   // E
      { dx: 1, dy: 1 },   // SE
      { dx: 0, dy: 1 },   // S
      { dx: -1, dy: 1 },  // SW
      { dx: -1, dy: 0 },  // W
      { dx: -1, dy: -1 }  // NW
    ];

    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      if (this.isWalkable(nx, ny)) {
        // For diagonal movement, check if both adjacent cells are walkable
        // (prevents cutting corners through buildings)
        if (dir.dx !== 0 && dir.dy !== 0) {
          const checkX = this.isWalkable(x + dir.dx, y);
          const checkY = this.isWalkable(x, y + dir.dy);

          if (checkX && checkY) {
            neighbors.push({ x: nx, y: ny });
          }
        } else {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }

    return neighbors;
  }

  /**
   * Reconstruct path from A* result
   */
  private reconstructGridPath(endNode: { x: number; y: number; parent: any }): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: any = endNode;

    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }

    return path;
  }

  /**
   * Simplify path by removing unnecessary waypoints
   */
  private simplifyPath(path: [number, number][]): [number, number][] {
    if (path.length <= 2) return path;

    const simplified: [number, number][] = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      let farthest = current + 1;

      // Find farthest visible point
      for (let i = current + 2; i < path.length; i++) {
        if (this.isLineOfSightClear(path[current], path[i])) {
          farthest = i;
        } else {
          break;
        }
      }

      simplified.push(path[farthest]);
      current = farthest;
    }

    return simplified;
  }

  /**
   * Check if line of sight is clear between two points (on grid)
   */
  private isLineOfSightClear(from: [number, number], to: [number, number]): boolean {
    const x0 = this.lngToGridX(from[0]);
    const y0 = this.latToGridY(from[1]);
    const x1 = this.lngToGridX(to[0]);
    const y1 = this.latToGridY(to[1]);

    // Bresenham's line algorithm
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;
    let x = x0;
    let y = y0;

    while (true) {
      if (!this.isWalkable(x, y)) {
        return false;
      }

      if (x === x1 && y === y1) {
        return true;
      }

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
  }

  /**
   * Heuristic for A* (Euclidean distance)
   */
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if grid cell is walkable
   */
  private isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) {
      return false;
    }

    const index = y * this.gridWidth + x;
    return this.grid[index] === 1;
  }

  /**
   * Check if grid coordinates are in bounds
   */
  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  // Coordinate conversion methods

  private lngToGridX(lng: number): number {
    const x = Math.floor((lng - this.bounds[0]) / this.cellSizeDegrees);
    return Math.max(0, Math.min(this.gridWidth - 1, x));
  }

  private latToGridY(lat: number): number {
    const y = Math.floor((lat - this.bounds[1]) / this.cellSizeDegrees);
    return Math.max(0, Math.min(this.gridHeight - 1, y));
  }

  private gridXToLng(x: number): number {
    return this.bounds[0] + (x + 0.5) * this.cellSizeDegrees;
  }

  private gridYToLat(y: number): number {
    return this.bounds[1] + (y + 0.5) * this.cellSizeDegrees;
  }

  /**
   * Convert meters to degrees at a given latitude
   */
  private metersToDegrees(meters: number, latitude: number): number {
    const metersPerDegree = 111320 * Math.cos((latitude * Math.PI) / 180);
    return meters / metersPerDegree;
  }

  /**
   * Get grid dimensions
   */
  getGridInfo() {
    return {
      width: this.gridWidth,
      height: this.gridHeight,
      cellSizeMeters: this.cellSizeMeters,
      cellSizeDegrees: this.cellSizeDegrees,
      totalCells: this.gridWidth * this.gridHeight,
      walkableCells: this.grid.filter(cell => cell === 1).length,
      blockedCells: this.grid.filter(cell => cell === 0).length
    };
  }
}
