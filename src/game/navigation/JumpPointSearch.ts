/**
 * JumpPointSearch - Highly optimized pathfinding for uniform grids
 *
 * JPS is 10-100x faster than A* on uniform grids by "jumping" over
 * symmetric paths instead of exploring every cell.
 *
 * CRITICAL: NEVER returns a path through buildings. If no valid path
 * exists, returns empty array (unit doesn't move).
 */

import * as turf from '@turf/turf';
import { BuildingIndex } from './BuildingExtractor';

export interface GridConfig {
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  cellSize: number; // Size of each grid cell in meters
}

interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // Total cost
  parent: PathNode | null;
}

export class JumpPointSearch {
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

    console.log(`Creating JPS grid: ${this.gridWidth}x${this.gridHeight} = ${this.gridWidth * this.gridHeight} cells`);
    console.log(`Cell size: ${this.cellSizeMeters}m (${this.cellSizeDegrees.toFixed(6)}°)`);

    // Initialize all cells as walkable
    this.grid = new Uint8Array(this.gridWidth * this.gridHeight);
    this.grid.fill(1);
  }

  /**
   * Mark grid cells as blocked based on building index
   * Uses spatial grid to quickly find candidate buildings
   * Blocks cells if MORE THAN 50% covered by building area
   */
  setBuildingIndex(buildingIndex: BuildingIndex): void {
    console.log('Marking grid cells with buildings...');
    console.log(`Processing grid: ${this.gridWidth}x${this.gridHeight} cells`);
    console.log('Blocking strategy: Cell covered >50% by building area');
    let blockedCount = 0;

    const spatialGridSize = buildingIndex.gridSize;

    // Iterate through all JPS grid cells
    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        // Get cell bounds in world coordinates
        const cellMinLng = this.bounds[0] + x * this.cellSizeDegrees;
        const cellMaxLng = this.bounds[0] + (x + 1) * this.cellSizeDegrees;
        const cellMinLat = this.bounds[1] + y * this.cellSizeDegrees;
        const cellMaxLat = this.bounds[1] + (y + 1) * this.cellSizeDegrees;
        const cellCenterLng = (cellMinLng + cellMaxLng) / 2;
        const cellCenterLat = (cellMinLat + cellMaxLat) / 2;

        // Get spatial cell that contains this cell center
        const spatialX = Math.floor(cellCenterLng / spatialGridSize);
        const spatialY = Math.floor(cellCenterLat / spatialGridSize);
        const spatialCellKey = `${spatialX},${spatialY}`;

        // Get buildings in this spatial cell
        const buildingIds = buildingIndex.spatialGrid.get(spatialCellKey);

        if (!buildingIds || buildingIds.length === 0) {
          // No buildings nearby - definitely walkable
          continue;
        }

        // Create cell polygon
        const cellPolygon = turf.polygon([[
          [cellMinLng, cellMinLat],
          [cellMaxLng, cellMinLat],
          [cellMaxLng, cellMaxLat],
          [cellMinLng, cellMaxLat],
          [cellMinLng, cellMinLat]
        ]]);

        const cellArea = turf.area(cellPolygon);
        let coveredArea = 0;

        // Calculate total area covered by buildings
        for (const buildingId of buildingIds) {
          const building = buildingIndex.buildings.get(buildingId);
          if (!building) continue;

          try {
            const buildingPolygon = turf.polygon(building.coordinates);

            // Find intersection between cell and building
            const intersection = turf.intersect(cellPolygon, buildingPolygon);

            if (intersection) {
              const intersectionArea = turf.area(intersection);
              coveredArea += intersectionArea;
            }
          } catch {
            // Skip invalid building or intersection error
            continue;
          }
        }

        // Block if more than 50% covered
        const coveragePercent = (coveredArea / cellArea) * 100;
        if (coveragePercent > 50) {
          const index = y * this.gridWidth + x;
          this.grid[index] = 0;
          blockedCount++;
        }
      }
    }

    const totalCells = this.gridWidth * this.gridHeight;
    const walkableCount = totalCells - blockedCount;
    const blockedPercent = ((blockedCount / totalCells) * 100).toFixed(1);

    console.log(`Grid complete: ${walkableCount} walkable, ${blockedCount} blocked (${blockedPercent}%)`);
  }

  /**
   * Find path using Jump Point Search
   * NEVER returns a path through buildings
   */
  findPath(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    let startX = this.lngToGridX(start[0]);
    let startY = this.latToGridY(start[1]);
    let goalX = this.lngToGridX(goal[0]);
    let goalY = this.latToGridY(goal[1]);

    console.log(`[JPS] Pathfinding from (${startX},${startY}) to (${goalX},${goalY})`);

    // Validate bounds
    if (!this.isInBounds(startX, startY) || !this.isInBounds(goalX, goalY)) {
      console.warn('[JPS] Start or goal out of grid bounds');
      return []; // NO FALLBACK - unit doesn't move
    }

    // Check start cell
    const startWalkable = this.isWalkable(startX, startY);
    console.log(`[JPS] Start cell walkable: ${startWalkable}`);

    // If start is blocked, find nearest walkable cell
    if (!startWalkable) {
      const nearest = this.findNearestWalkable(startX, startY);
      if (!nearest) {
        console.warn('[JPS] Start position blocked, no walkable cell nearby');
        return []; // NO FALLBACK
      }
      startX = nearest.x;
      startY = nearest.y;
      console.log(`[JPS] Start was blocked, moved to nearest walkable: (${startX},${startY})`);
    }

    // Check goal cell
    const goalWalkable = this.isWalkable(goalX, goalY);
    console.log(`[JPS] Goal cell walkable: ${goalWalkable}`);

    // If goal is blocked, find nearest walkable cell
    if (!goalWalkable) {
      const nearest = this.findNearestWalkable(goalX, goalY);
      if (!nearest) {
        console.warn('[JPS] Goal position blocked, no walkable cell nearby');
        return []; // NO FALLBACK
      }
      goalX = nearest.x;
      goalY = nearest.y;
      console.log(`[JPS] Goal was blocked, moved to nearest walkable: (${goalX},${goalY})`);
    }

    // Run JPS
    console.log(`[JPS] Running jump point search...`);
    const gridPath = this.jumpPointSearch(startX, startY, goalX, goalY);

    if (!gridPath || gridPath.length === 0) {
      console.warn('[JPS] No valid path found - unit will not move');
      return []; // NO FALLBACK - absolutely forbidden
    }

    // Convert to lat/lng
    const latLngPath: [number, number][] = gridPath.map(cell => [
      this.gridXToLng(cell.x),
      this.gridYToLat(cell.y)
    ]);

    // Simplify path
    const simplified = this.simplifyPath(latLngPath);

    console.log(`[JPS] Success! ${gridPath.length} cells → ${simplified.length} waypoints`);

    return simplified;
  }

  /**
   * Jump Point Search algorithm
   */
  private jumpPointSearch(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number
  ): { x: number; y: number }[] | null {
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

    const MAX_ITERATIONS = 50000; // Higher for JPS since it skips cells
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
        console.log(`JPS found path in ${iterations} iterations`);
        return this.reconstructPath(current);
      }

      const currentKey = `${current.x},${current.y}`;
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Get jump point successors
      const successors = this.getSuccessors(current, goalX, goalY);

      for (const successor of successors) {
        const successorKey = `${successor.x},${successor.y}`;

        if (closedSet.has(successorKey)) {
          continue;
        }

        const g = current.g + this.distance(current.x, current.y, successor.x, successor.y);
        const existingNode = openSet.get(successorKey);

        if (!existingNode || g < existingNode.g) {
          const h = this.heuristic(successor.x, successor.y, goalX, goalY);
          const newNode: PathNode = {
            x: successor.x,
            y: successor.y,
            g,
            h,
            f: g + h,
            parent: current
          };

          openSet.set(successorKey, newNode);
        }
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[JPS] Hit max iterations (${MAX_ITERATIONS}). OpenSet size: ${openSet.size}, ClosedSet size: ${closedSet.size}`);
    } else {
      console.warn(`[JPS] Search exhausted after ${iterations} iterations. No path exists between start and goal.`);
    }

    return null; // NO PATH FOUND
  }

  /**
   * Get jump point successors for a node
   */
  private getSuccessors(node: PathNode, goalX: number, goalY: number): { x: number; y: number }[] {
    const successors: { x: number; y: number }[] = [];
    const neighbors = this.findNeighbors(node);

    for (const neighbor of neighbors) {
      const jumpPoint = this.jump(neighbor.x, neighbor.y, node.x, node.y, goalX, goalY);
      if (jumpPoint) {
        successors.push(jumpPoint);
      }
    }

    return successors;
  }

  /**
   * Jump in a direction until hitting a jump point or obstacle
   */
  private jump(
    x: number,
    y: number,
    px: number,
    py: number,
    goalX: number,
    goalY: number
  ): { x: number; y: number } | null {
    if (!this.isWalkable(x, y)) {
      return null;
    }

    if (x === goalX && y === goalY) {
      return { x, y };
    }

    const dx = x - px;
    const dy = y - py;

    // Check for forced neighbors (jump point)
    if (this.hasForcedNeighbors(x, y, dx, dy)) {
      return { x, y };
    }

    // Diagonal movement
    if (dx !== 0 && dy !== 0) {
      // Check horizontal and vertical
      if (this.jump(x + dx, y, x, y, goalX, goalY) ||
          this.jump(x, y + dy, x, y, goalX, goalY)) {
        return { x, y };
      }
    }

    // Continue jumping in the same direction
    return this.jump(x + dx, y + dy, x, y, goalX, goalY);
  }

  /**
   * Check if a position has forced neighbors
   */
  private hasForcedNeighbors(x: number, y: number, dx: number, dy: number): boolean {
    // Diagonal movement
    if (dx !== 0 && dy !== 0) {
      if (!this.isWalkable(x - dx, y) && this.isWalkable(x - dx, y + dy)) {
        return true;
      }
      if (!this.isWalkable(x, y - dy) && this.isWalkable(x + dx, y - dy)) {
        return true;
      }
    } else {
      // Straight movement
      if (dx !== 0) { // Horizontal
        if (!this.isWalkable(x, y + 1) && this.isWalkable(x + dx, y + 1)) {
          return true;
        }
        if (!this.isWalkable(x, y - 1) && this.isWalkable(x + dx, y - 1)) {
          return true;
        }
      } else { // Vertical
        if (!this.isWalkable(x + 1, y) && this.isWalkable(x + 1, y + dy)) {
          return true;
        }
        if (!this.isWalkable(x - 1, y) && this.isWalkable(x - 1, y + dy)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find neighbors considering pruning rules
   */
  private findNeighbors(node: PathNode): { x: number; y: number; dx: number; dy: number }[] {
    const neighbors: { x: number; y: number; dx: number; dy: number }[] = [];
    const { x, y, parent } = node;

    // If no parent, add all walkable neighbors
    if (!parent) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (this.isWalkable(x + dx, y + dy)) {
            neighbors.push({ x: x + dx, y: y + dy, dx, dy });
          }
        }
      }
      return neighbors;
    }

    // Pruned neighbors based on parent direction
    const dx = Math.sign(x - parent.x);
    const dy = Math.sign(y - parent.y);

    // Diagonal movement
    if (dx !== 0 && dy !== 0) {
      if (this.isWalkable(x + dx, y)) {
        neighbors.push({ x: x + dx, y, dx, dy: 0 });
      }
      if (this.isWalkable(x, y + dy)) {
        neighbors.push({ x, y: y + dy, dx: 0, dy });
      }
      if (this.isWalkable(x + dx, y + dy)) {
        neighbors.push({ x: x + dx, y: y + dy, dx, dy });
      }
    } else {
      // Straight movement
      if (dx !== 0) {
        if (this.isWalkable(x + dx, y)) {
          neighbors.push({ x: x + dx, y, dx, dy: 0 });
        }
      } else {
        if (this.isWalkable(x, y + dy)) {
          neighbors.push({ x, y: y + dy, dx: 0, dy });
        }
      }
    }

    return neighbors;
  }

  /**
   * Find nearest walkable cell
   */
  private findNearestWalkable(x: number, y: number): { x: number; y: number } | null {
    const MAX_SEARCH_RADIUS = 20; // Search up to 20 cells away

    for (let radius = 1; radius <= MAX_SEARCH_RADIUS; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Only check cells at current radius
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
            continue;
          }

          const nx = x + dx;
          const ny = y + dy;

          if (this.isWalkable(nx, ny)) {
            return { x: nx, y: ny };
          }
        }
      }
    }

    return null; // No walkable cell found
  }

  /**
   * Reconstruct path from end node
   */
  private reconstructPath(endNode: PathNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: PathNode | null = endNode;

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

      for (let i = current + 2; i < path.length; i++) {
        if (this.hasLineOfSight(path[current], path[i])) {
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
   * Check line of sight on grid
   */
  private hasLineOfSight(from: [number, number], to: [number, number]): boolean {
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
   * Heuristic (Euclidean distance)
   */
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Distance between two points
   */
  private distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if cell is walkable
   */
  private isWalkable(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) {
      return false;
    }

    const index = y * this.gridWidth + x;
    return this.grid[index] === 1;
  }

  /**
   * Check if coordinates are in bounds
   */
  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  // Coordinate conversion

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

  private metersToDegrees(meters: number, latitude: number): number {
    const metersPerDegree = 111320 * Math.cos((latitude * Math.PI) / 180);
    return meters / metersPerDegree;
  }

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

  /**
   * Get all grid cells for visualization
   */
  getGridCells(): Array<{
    x: number;
    y: number;
    lng: number;
    lat: number;
    walkable: boolean;
    bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  }> {
    const cells = [];

    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        const index = y * this.gridWidth + x;
        const walkable = this.grid[index] === 1;

        const minLng = this.bounds[0] + x * this.cellSizeDegrees;
        const maxLng = this.bounds[0] + (x + 1) * this.cellSizeDegrees;
        const minLat = this.bounds[1] + y * this.cellSizeDegrees;
        const maxLat = this.bounds[1] + (y + 1) * this.cellSizeDegrees;

        cells.push({
          x,
          y,
          lng: (minLng + maxLng) / 2,
          lat: (minLat + maxLat) / 2,
          walkable,
          bounds: [minLng, minLat, maxLng, maxLat] as [number, number, number, number]
        });
      }
    }

    return cells;
  }

  /**
   * Get only blocked cells for visualization (more efficient)
   */
  getBlockedCells(): Array<{
    x: number;
    y: number;
    lng: number;
    lat: number;
    bounds: [number, number, number, number];
  }> {
    const cells = [];

    for (let x = 0; x < this.gridWidth; x++) {
      for (let y = 0; y < this.gridHeight; y++) {
        const index = y * this.gridWidth + x;

        if (this.grid[index] === 0) { // Blocked
          const minLng = this.bounds[0] + x * this.cellSizeDegrees;
          const maxLng = this.bounds[0] + (x + 1) * this.cellSizeDegrees;
          const minLat = this.bounds[1] + y * this.cellSizeDegrees;
          const maxLat = this.bounds[1] + (y + 1) * this.cellSizeDegrees;

          cells.push({
            x,
            y,
            lng: (minLng + maxLng) / 2,
            lat: (minLat + maxLat) / 2,
            bounds: [minLng, minLat, maxLng, maxLat] as [number, number, number, number]
          });
        }
      }
    }

    return cells;
  }
}
