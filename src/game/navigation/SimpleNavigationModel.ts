/**
 * SimpleNavigationModel - Building-aware pathfinding with simple caching
 *
 * Replaces the complex PathNetwork system with a simpler approach:
 * - Extract buildings from vector tiles once
 * - Create grid representation with blocked cells
 * - Use Jump Point Search (10-100x faster than A*)
 * - NEVER allows units to walk through buildings
 * - Cache paths for performance
 */

import { JumpPointSearch } from './JumpPointSearch';
import { BuildingExtractor, type BuildingIndex } from './BuildingExtractor';

export interface NavigationCache {
  [miniatureId: string]: {
    target: [number, number];
    path: [number, number][];
    currentIndex: number;
    lastUpdate: number;
  };
}

export interface MovementRequest {
  miniatureId: string;
  start: [number, number];
  target: [number, number];
  maxDistance: number;
}

export interface MovementResult {
  newPosition: [number, number];
  remainingPath: [number, number][];
  completed: boolean;
}

export class SimpleNavigationModel {
  private pathfinder: JumpPointSearch | null = null;
  private buildingIndex: BuildingIndex | null = null;
  private navigationCache: NavigationCache = {};
  private isInitialized = false;

  // Configuration
  private readonly CACHE_TIMEOUT = 60000; // 1 minute cache
  private readonly PATH_SEGMENT_LENGTH = 5; // meters per movement step
  private readonly GRID_CELL_SIZE = 18; // 18 meters per grid cell (fast pathfinding)

  /**
   * Initialize the navigation system
   */
  async initialize(
    bounds: [number, number, number, number],
    styleUrl: string = ''
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing simple navigation model...');

    // Extract buildings from vector tiles
    const extractor = new BuildingExtractor({
      bounds,
      zoom: 14,
      styleUrl,
      gridSize: 0.001, // ~100m spatial grid
    });

    this.buildingIndex = await extractor.extractBuildings();

    // Create JPS pathfinder with optimized grid
    this.pathfinder = new JumpPointSearch({
      bounds,
      cellSize: this.GRID_CELL_SIZE
    });

    // Mark grid cells with buildings
    this.pathfinder.setBuildingIndex(this.buildingIndex);

    this.isInitialized = true;

    console.log('Navigation initialized with Jump Point Search');
    console.log('Grid info:', this.pathfinder.getGridInfo());
  }

  /**
   * Plan movement for a miniature
   */
  async planMovement(request: MovementRequest): Promise<void> {
    if (!this.isInitialized || !this.pathfinder) {
      console.warn('Navigation not initialized');
      return;
    }

    const { miniatureId, start, target } = request;

    // Check if we need to recalculate
    const cached = this.navigationCache[miniatureId];
    if (this.shouldRecalculatePath(cached, target)) {
      try {
        const path = this.pathfinder.findPath(start, target);

        this.navigationCache[miniatureId] = {
          target,
          path,
          currentIndex: 0,
          lastUpdate: Date.now(),
        };
      } catch (error) {
        console.error(`Pathfinding failed for ${miniatureId}:`, error);
      }
    }
  }

  /**
   * Execute a movement step
   */
  executeMovement(request: MovementRequest): MovementResult {
    const { miniatureId, start, maxDistance } = request;
    const cached = this.navigationCache[miniatureId];

    if (!cached || cached.path.length === 0) {
      return {
        newPosition: start,
        remainingPath: [],
        completed: true,
      };
    }

    // Follow the cached path
    let currentPosition = start;
    let remainingDistance = maxDistance;
    let currentIndex = cached.currentIndex;

    while (currentIndex < cached.path.length && remainingDistance > 0) {
      const nextWaypoint = cached.path[currentIndex];
      const distance = this.calculateDistance(currentPosition, nextWaypoint);

      if (distance <= remainingDistance) {
        // Can reach this waypoint
        currentPosition = nextWaypoint;
        remainingDistance -= distance;
        currentIndex++;
      } else {
        // Move partially toward waypoint
        const t = remainingDistance / distance;
        currentPosition = [
          currentPosition[0] + (nextWaypoint[0] - currentPosition[0]) * t,
          currentPosition[1] + (nextWaypoint[1] - currentPosition[1]) * t,
        ];
        remainingDistance = 0;
      }
    }

    // Update cache
    this.navigationCache[miniatureId] = {
      ...cached,
      currentIndex,
      lastUpdate: Date.now(),
    };

    const completed = currentIndex >= cached.path.length;

    return {
      newPosition: currentPosition,
      remainingPath: cached.path.slice(currentIndex),
      completed,
    };
  }

  /**
   * Get current path for a miniature
   */
  getPath(miniatureId: string): [number, number][] | null {
    const cached = this.navigationCache[miniatureId];
    return cached?.path || null;
  }

  /**
   * Clear navigation cache for a miniature
   */
  clearCache(miniatureId: string): void {
    delete this.navigationCache[miniatureId];
  }

  /**
   * Get building index for visualization
   */
  getBuildingIndex(): BuildingIndex | null {
    return this.buildingIndex;
  }

  /**
   * Get pathfinder for grid visualization
   */
  getPathfinder(): JumpPointSearch | null {
    return this.pathfinder;
  }

  /**
   * Get tiles used for building extraction (for debug visualization)
   */
  getTiles(): Array<{
    x: number;
    y: number;
    z: number;
    bounds: [number, number, number, number];
  }> | null {
    return this.buildingIndex?.tiles || null;
  }

  // Private methods

  private shouldRecalculatePath(
    cached: NavigationCache[string] | undefined,
    target: [number, number]
  ): boolean {
    if (!cached) {
      return true;
    }

    // Check if target changed
    const targetChanged =
      Math.abs(cached.target[0] - target[0]) > 0.00001 ||
      Math.abs(cached.target[1] - target[1]) > 0.00001;

    if (targetChanged) {
      return true;
    }

    // Check cache timeout
    const cacheExpired = Date.now() - cached.lastUpdate > this.CACHE_TIMEOUT;

    return cacheExpired;
  }

  private calculateDistance(
    a: [number, number],
    b: [number, number]
  ): number {
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

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
