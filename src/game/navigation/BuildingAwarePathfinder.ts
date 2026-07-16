/**
 * BuildingAwarePathfinder - A* pathfinding that avoids buildings
 *
 * This pathfinder uses a sparse waypoint approach with building collision detection.
 * Instead of pre-computing a network, it dynamically generates waypoints when needed.
 */

import * as turf from '@turf/turf';
import { BuildingExtractor, BuildingIndex, BuildingPolygon } from './BuildingExtractor';

export interface PathfindingNode {
  position: [number, number];
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // Total cost (g + h)
  parent: PathfindingNode | null;
}

export class BuildingAwarePathfinder {
  private buildingIndex: BuildingIndex | null = null;
  private isInitialized = false;

  // Configuration
  private readonly WAYPOINT_STEP = 0.0001; // ~10m in degrees - for direct paths
  private readonly CORNER_BUFFER = 0.00001; // ~1m buffer around corners
  private readonly MAX_ITERATIONS = 1000; // Prevent infinite loops - reduced for performance
  private readonly MAX_BUILDING_CHECK = 50; // Max buildings to check for collision

  /**
   * Initialize pathfinder with building data
   */
  async initialize(
    bounds: [number, number, number, number],
    zoom: number = 13,
    styleUrl: string = ''
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing building-aware pathfinder...');

    const extractor = new BuildingExtractor({
      bounds,
      zoom,
      styleUrl,
      gridSize: 0.001, // ~100m spatial grid
    });

    this.buildingIndex = await extractor.extractBuildings();
    this.isInitialized = true;

    console.log(
      `Pathfinder initialized with ${this.buildingIndex.buildings.size} buildings`
    );
  }

  /**
   * Find a path from start to goal avoiding buildings
   */
  findPath(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    if (!this.isInitialized || !this.buildingIndex) {
      console.warn('Pathfinder not initialized');
      return [start, goal];
    }

    // Check if direct path is clear
    const directCheck = this.checkLineCollision(start, goal);
    if (!directCheck.intersects) {
      return [start, goal];
    }

    // Need to pathfind around buildings
    return this.aStarWithBuildings(start, goal);
  }

  /**
   * A* pathfinding with dynamic waypoint generation
   */
  private aStarWithBuildings(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    const openSet = new Map<string, PathfindingNode>();
    const closedSet = new Set<string>();

    const startNode: PathfindingNode = {
      position: start,
      g: 0,
      h: this.heuristic(start, goal),
      f: this.heuristic(start, goal),
      parent: null,
    };

    openSet.set(this.nodeKey(start), startNode);

    let iterations = 0;

    while (openSet.size > 0 && iterations < this.MAX_ITERATIONS) {
      iterations++;

      // Get node with lowest f score
      let currentNode: PathfindingNode | null = null;
      let lowestF = Infinity;

      for (const node of Array.from(openSet.values())) {
        if (node.f < lowestF) {
          lowestF = node.f;
          currentNode = node;
        }
      }

      if (!currentNode) break;

      // Check if we reached the goal
      if (this.distance(currentNode.position, goal) < this.WAYPOINT_STEP) {
        return this.reconstructPath(currentNode, goal);
      }

      const currentKey = this.nodeKey(currentNode.position);
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Generate neighbors
      const neighbors = this.getNeighbors(currentNode.position, goal);

      for (const neighborPos of neighbors) {
        const neighborKey = this.nodeKey(neighborPos);

        if (closedSet.has(neighborKey)) {
          continue;
        }

        // Check if path to neighbor is clear
        const collision = this.checkLineCollision(currentNode.position, neighborPos);
        if (collision.intersects) {
          continue;
        }

        const g = currentNode.g + this.distance(currentNode.position, neighborPos);
        const h = this.heuristic(neighborPos, goal);
        const f = g + h;

        const existingNode = openSet.get(neighborKey);

        if (!existingNode || g < existingNode.g) {
          const neighborNode: PathfindingNode = {
            position: neighborPos,
            g,
            h,
            f,
            parent: currentNode,
          };

          openSet.set(neighborKey, neighborNode);
        }
      }
    }

    if (iterations >= this.MAX_ITERATIONS) {
      console.warn('Pathfinding hit max iterations');
    }

    // No path found, return direct line
    console.warn('No path found, returning direct line');
    return [start, goal];
  }

  /**
   * Generate neighbor waypoints for pathfinding
   */
  private getNeighbors(
    position: [number, number],
    goal: [number, number]
  ): [number, number][] {
    const neighbors: [number, number][] = [];

    // Always try direct path to goal first
    neighbors.push(goal);

    // Get nearby buildings efficiently using spatial grid
    const nearbyBuildings = this.getNearbyBuildingsFromGrid(position, 0.0005);

    // Limit building checks to prevent freezing
    const buildingsToCheck = nearbyBuildings.slice(0, this.MAX_BUILDING_CHECK);

    for (const building of buildingsToCheck) {
      // Add building corners as potential waypoints
      const corners = this.getBuildingCornerWaypoints(building);
      neighbors.push(...corners);
    }

    // Add waypoints in cardinal directions for exploration
    const step = this.WAYPOINT_STEP * 3; // ~30m steps
    const cardinalPoints: [number, number][] = [
      [position[0] + step, position[1]], // East
      [position[0] - step, position[1]], // West
      [position[0], position[1] + step], // North
      [position[0], position[1] - step], // South
    ];

    neighbors.push(...cardinalPoints);

    // Add waypoint toward goal
    const toGoal = this.interpolatePoint(position, goal, step);
    if (toGoal) {
      neighbors.push(toGoal);
    }

    return neighbors;
  }

  /**
   * Get nearby buildings using spatial grid (faster than iterating all)
   */
  private getNearbyBuildingsFromGrid(
    position: [number, number],
    radius: number
  ): BuildingPolygon[] {
    if (!this.buildingIndex) return [];

    const { gridSize } = this.buildingIndex;
    const cellRadius = Math.ceil(radius / gridSize);
    const centerX = Math.floor(position[0] / gridSize);
    const centerY = Math.floor(position[1] / gridSize);

    const buildingIds = new Set<string>();

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const cellKey = `${centerX + dx},${centerY + dy}`;
        const ids = this.buildingIndex.spatialGrid.get(cellKey) || [];
        ids.forEach(id => buildingIds.add(id));
      }
    }

    const buildings: BuildingPolygon[] = [];
    for (const id of Array.from(buildingIds)) {
      const building = this.buildingIndex.buildings.get(id);
      if (building) {
        buildings.push(building);
      }
    }

    return buildings;
  }

  /**
   * Get corner waypoints for a building with buffer
   */
  private getBuildingCornerWaypoints(building: BuildingPolygon): [number, number][] {
    const corners: [number, number][] = [];
    const outerRing = building.coordinates[0];

    for (let i = 0; i < outerRing.length; i++) {
      const corner = outerRing[i];

      // Get adjacent points to determine corner angle
      const prev = outerRing[(i - 1 + outerRing.length) % outerRing.length];
      const next = outerRing[(i + 1) % outerRing.length];

      // Create waypoint slightly away from corner
      const offsetCorner = this.offsetPoint(
        [corner[0], corner[1]],
        [prev[0], prev[1]],
        [next[0], next[1]],
        this.CORNER_BUFFER
      );

      corners.push(offsetCorner);
    }

    return corners;
  }

  /**
   * Offset a corner point outward from the building
   */
  private offsetPoint(
    corner: [number, number],
    prev: [number, number],
    next: [number, number],
    distance: number
  ): [number, number] {
    // Calculate bisector direction
    const v1 = this.normalize([prev[0] - corner[0], prev[1] - corner[1]]);
    const v2 = this.normalize([next[0] - corner[0], next[1] - corner[1]]);

    const bisector = [v1[0] + v2[0], v1[1] + v2[1]];
    const bisectorNorm = this.normalize(bisector);

    // Offset in opposite direction of bisector (outward from building)
    return [
      corner[0] - bisectorNorm[0] * distance,
      corner[1] - bisectorNorm[1] * distance,
    ];
  }

  /**
   * Check if line intersects any buildings (optimized)
   */
  private checkLineCollision(
    from: [number, number],
    to: [number, number]
  ): { intersects: boolean; buildings: BuildingPolygon[] } {
    if (!this.buildingIndex) {
      return { intersects: false, buildings: [] };
    }

    // Get cells along the line
    const cells = this.getCellsAlongLine(from, to);
    const potentialBuildings = new Set<string>();

    for (const cellKey of cells) {
      const buildingIds = this.buildingIndex.spatialGrid.get(cellKey) || [];
      buildingIds.forEach(id => potentialBuildings.add(id));
    }

    // Quick line bounds check
    const lineMinLng = Math.min(from[0], to[0]);
    const lineMaxLng = Math.max(from[0], to[0]);
    const lineMinLat = Math.min(from[1], to[1]);
    const lineMaxLat = Math.max(from[1], to[1]);

    const intersectingBuildings: BuildingPolygon[] = [];

    // Limit checks to prevent freezing
    let checkCount = 0;
    const MAX_CHECKS = 100;

    for (const buildingId of Array.from(potentialBuildings)) {
      if (checkCount++ > MAX_CHECKS) break;

      const building = this.buildingIndex.buildings.get(buildingId);
      if (!building) continue;

      // Quick bounding box check first
      const { bounds } = building;
      if (
        lineMaxLng < bounds.minLng ||
        lineMinLng > bounds.maxLng ||
        lineMaxLat < bounds.minLat ||
        lineMinLat > bounds.maxLat
      ) {
        continue;
      }

      // Detailed polygon check only if bounding boxes intersect
      try {
        const line = turf.lineString([from, to]);
        const polygon = turf.polygon(building.coordinates);

        // @ts-ignore - booleanIntersects exists but TypeScript definition is missing
        if (turf.booleanIntersects(line, polygon)) {
          intersectingBuildings.push(building);
        }
      } catch {
        // If detailed check fails, skip this building
        continue;
      }
    }

    return {
      intersects: intersectingBuildings.length > 0,
      buildings: intersectingBuildings,
    };
  }

  /**
   * Reconstruct path from A* result
   */
  private reconstructPath(
    endNode: PathfindingNode,
    goal: [number, number]
  ): [number, number][] {
    const path: [number, number][] = [goal];
    let current: PathfindingNode | null = endNode;

    while (current) {
      path.unshift(current.position);
      current = current.parent;
    }

    return this.smoothPath(path);
  }

  /**
   * Smooth path by removing unnecessary waypoints
   */
  private smoothPath(path: [number, number][]): [number, number][] {
    if (path.length <= 2) return path;

    const smoothed: [number, number][] = [path[0]];

    let i = 0;
    while (i < path.length - 1) {
      let farthest = i + 1;

      // Find farthest point we can see
      for (let j = i + 2; j < path.length; j++) {
        const collision = this.checkLineCollision(path[i], path[j]);
        if (!collision.intersects) {
          farthest = j;
        } else {
          break;
        }
      }

      smoothed.push(path[farthest]);
      i = farthest;
    }

    return smoothed;
  }

  // Utility methods

  private heuristic(a: [number, number], b: [number, number]): number {
    return this.distance(a, b);
  }

  private distance(a: [number, number], b: [number, number]): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (a[1] * Math.PI) / 180;
    const φ2 = (b[1] * Math.PI) / 180;
    const Δφ = ((b[1] - a[1]) * Math.PI) / 180;
    const Δλ = ((b[0] - a[0]) * Math.PI) / 180;

    const α =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(α), Math.sqrt(1 - α));

    return R * c;
  }

  private nodeKey(position: [number, number]): string {
    return `${position[0].toFixed(6)},${position[1].toFixed(6)}`;
  }

  private normalize(vec: number[]): number[] {
    const mag = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);
    if (mag === 0) return [0, 0];
    return [vec[0] / mag, vec[1] / mag];
  }

  private interpolatePoint(
    from: [number, number],
    to: [number, number],
    distance: number
  ): [number, number] | null {
    const totalDist = this.distance(from, to);
    if (totalDist === 0) return null;

    const t = distance / totalDist;
    if (t >= 1) return to;

    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  }

  private isNearBuilding(
    position: [number, number],
    building: BuildingPolygon,
    radius: number
  ): boolean {
    const { bounds } = building;

    return !(
      position[0] + radius < bounds.minLng ||
      position[0] - radius > bounds.maxLng ||
      position[1] + radius < bounds.minLat ||
      position[1] - radius > bounds.maxLat
    );
  }

  private getCellsAlongLine(
    from: [number, number],
    to: [number, number]
  ): string[] {
    const gridSize = this.buildingIndex!.gridSize;
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

    while (true) {
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

  /**
   * Get building index for external use
   */
  getBuildingIndex(): BuildingIndex | null {
    return this.buildingIndex;
  }
}
