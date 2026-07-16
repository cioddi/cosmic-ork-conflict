/**
 * OptimizedNavigationModel - Efficient navigation with caching and smart pathfinding
 * Replaces the old BuildingNavigationModel with a much faster system
 * Fixed pathfinding frequency issues
 */

import { PathfindingManager } from './PathfindingManager';
import { NetworkGenerationOptions } from './PathNetwork';

export interface NavigationCache {
  [miniatureId: string]: {
    target: [number, number];
    path: [number, number][];
    currentIndex: number;
    lastUpdate: number;
    lastRecalculation?: number;
    isValid: boolean;
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

export class OptimizedNavigationModel {
  private pathfindingManager: PathfindingManager;
  private navigationCache: NavigationCache = {};
  private isInitialized = false;

  // Configuration
  private readonly CACHE_TIMEOUT = 300000; // 5 minutes - very long cache
  private readonly MIN_RECALC_DISTANCE = 200; // 200 meters - only recalc for major changes
  private readonly PATH_SEGMENT_LENGTH = 5; // meters per movement step
  private readonly MIN_RECALC_INTERVAL = 5000; // 5 seconds minimum between recalculations

  constructor() {
    this.pathfindingManager = new PathfindingManager({
      cacheTimeout: 30000, // 30 second cache
      maxCacheSize: 500,
      workerPoolSize: 2
    });
  }

  /**
   * Initialize the navigation system
   */
  async initialize(bounds: [number, number, number, number], styleUrl: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing optimized navigation model...');

    const networkOptions: NetworkGenerationOptions = {
      styleUrl,
      bounds,
      zoom: 14, // Match PathNetwork MAX_ZOOM for transportation layer
      roadLayers: ['transportation'], // Use transportation layer like debug layer
      buildingLayers: [], // No building processing for transportation network
      gridSpacing: 25, // Keep for compatibility but not used in transportation extraction
      maxNodeDistance: 100 // Keep for compatibility but not used in transportation extraction
    };

    await this.pathfindingManager.initialize(networkOptions);
    this.isInitialized = true;

    console.log('Optimized navigation model initialized');
  }

  /**
   * Plan movement for a miniature (async, non-blocking)
   */
  async planMovement(request: MovementRequest): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Navigation not initialized');
      return;
    }

    const { miniatureId, start, target } = request;

    // Check if we need to recalculate
    const cached = this.navigationCache[miniatureId];
    if (this.shouldRecalculatePath(cached, start, target)) {
      try {
        console.log(`Planning new path for ${miniatureId}`, { start, target });

        // Add timeout to prevent infinite waiting
        const pathPromise = this.pathfindingManager.findPathAsync(start, target);
        const timeoutPromise = new Promise<[number, number][]>((_, reject) => {
          setTimeout(() => reject(new Error('Path calculation timeout')), 10000); // 10 second timeout
        });

        const path = await Promise.race([pathPromise, timeoutPromise]);

        if (path.length > 0) {
          this.navigationCache[miniatureId] = {
            target: [...target],
            path: path.map(coord => [...coord] as [number, number]),
            currentIndex: 0,
            lastUpdate: Date.now(),
            lastRecalculation: Date.now(),
            isValid: true
          };

          console.log(`Path planned for ${miniatureId}: ${path.length} waypoints`);
        } else {
          console.warn(`No path found for ${miniatureId}`);
          this.invalidateCache(miniatureId);
        }
      } catch (error) {
        console.error(`Failed to plan path for ${miniatureId}:`, error);
        // Create a simple direct path as fallback
        this.createFallbackPath(miniatureId, start, target);
      }
    }
  }

  /**
   * Pre-calculate path for a miniature (immediate, for initial setup)
   */
  preCalculatePath(miniatureId: string, start: [number, number], target: [number, number]): void {
    if (!this.isInitialized) {
      console.warn('Navigation not initialized');
      return;
    }

    try {
      // Use sync pathfinding for immediate path calculation
      const path = this.pathfindingManager.findPathSync(start, target);

      if (path.length > 0) {
        this.navigationCache[miniatureId] = {
          target: [...target],
          path: path.map(coord => [...coord] as [number, number]),
          currentIndex: 0,
          lastUpdate: Date.now(),
          lastRecalculation: Date.now(),
          isValid: true
        };

        console.log(`Path pre-calculated for ${miniatureId}:`, path.length, 'waypoints');
      } else {
        console.warn(`No path found for ${miniatureId} during pre-calculation`);
      }
    } catch (error) {
      console.error(`Failed to pre-calculate path for ${miniatureId}:`, error);
    }
  }

  /**
   * Execute movement for a miniature (synchronous, fast)
   */
  executeMovement(request: MovementRequest): MovementResult {
    const { miniatureId, start, maxDistance } = request;

    const cached = this.navigationCache[miniatureId];
    if (!cached || !cached.isValid || cached.path.length === 0) {
      // No valid path - units must use transportation network only
      console.warn(`No valid cached path for ${miniatureId}, blocking movement`);
      return {
        newPosition: [...start] as [number, number],
        remainingPath: [],
        completed: false
      };
    }

    // Follow the cached path
    return this.followCachedPath(cached, start, maxDistance);
  }

  /**
   * Check if a position is walkable (fast lookup)
   */
  isPointWalkable(position: [number, number]): boolean {
    // This is a simplified check - in practice, you'd use the spatial index
    // from the path network to quickly determine walkability
    return true; // For now, assume all points are walkable
  }

  /**
   * Clear navigation cache for a miniature
   */
  clearCache(miniatureId: string): void {
    delete this.navigationCache[miniatureId];
  }

  /**
   * Clear all navigation caches
   */
  clearAllCaches(): void {
    this.navigationCache = {};
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    const cacheEntries = Object.entries(this.navigationCache);

    return {
      navigation: {
        initialized: this.isInitialized,
        cachedPaths: cacheEntries.length,
        validPaths: cacheEntries.filter(([_, cache]) => cache.isValid).length
      },
      pathfinding: this.pathfindingManager.getCacheStats(),
      network: this.pathfindingManager.getNetworkInfo()
    };
  }

  /**
   * Get the transportation network for accessing nodes
   */
  getNetwork() {
    return this.pathfindingManager.getNetwork();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.pathfindingManager.dispose();
    this.navigationCache = {};
    this.isInitialized = false;
  }

  // Private methods

  private shouldRecalculatePath(
    cached: NavigationCache[string] | undefined,
    start: [number, number],
    target: [number, number]
  ): boolean {
    if (!cached || !cached.isValid) {
      console.log('Path recalc: No valid cache');
      return true;
    }

    // Check minimum recalculation interval to prevent rapid oscillation
    const lastRecalc = cached.lastRecalculation || 0;
    const timeSinceLastRecalc = Date.now() - lastRecalc;
    if (lastRecalc > 0 && timeSinceLastRecalc < this.MIN_RECALC_INTERVAL) {
      console.log(`Path recalc: Too soon (${timeSinceLastRecalc}ms < ${this.MIN_RECALC_INTERVAL}ms)`);
      return false;
    }

    // Check if cache is expired
    const age = Date.now() - cached.lastUpdate;
    if (age > this.CACHE_TIMEOUT) {
      console.log(`Path recalc: Cache expired (${age}ms > ${this.CACHE_TIMEOUT}ms)`);
      return true;
    }

    // Check if target has changed significantly
    const targetDistance = this.calculateDistance(cached.target, target);
    if (targetDistance > this.MIN_RECALC_DISTANCE) {
      console.log(`Path recalc: Target moved ${targetDistance.toFixed(1)}m > ${this.MIN_RECALC_DISTANCE}m`);
      return true;
    }

    // Check if we've deviated significantly from the path (more lenient)
    const deviation = this.calculatePathDeviation(cached, start);
    if (deviation > this.MIN_RECALC_DISTANCE * 1.5) { // 1.5x more lenient
      console.log(`Path recalc: Deviation ${deviation.toFixed(1)}m > ${(this.MIN_RECALC_DISTANCE * 1.5).toFixed(1)}m`);
      return true;
    }

    // Check if we're near the end of the path - no need to recalculate
    const remainingWaypoints = cached.path.length - cached.currentIndex;
    if (remainingWaypoints <= 3) {
      console.log(`Path recalc: Near end of path (${remainingWaypoints} waypoints left), keeping current path`);
      return false;
    }

    // Path is still valid - no recalculation needed
    return false;
  }

  private calculatePathDeviation(
    cached: NavigationCache[string],
    currentPosition: [number, number]
  ): number {
    if (cached.currentIndex >= cached.path.length) {
      return Infinity;
    }

    const expectedPosition = cached.path[cached.currentIndex];
    return this.calculateDistance(currentPosition, expectedPosition);
  }

  private followCachedPath(
    cached: NavigationCache[string],
    start: [number, number],
    maxDistance: number
  ): MovementResult {
    let currentPos = [...start] as [number, number];
    let remainingDistance = maxDistance;
    let pathIndex = cached.currentIndex;

    // Move along the path as far as we can
    while (remainingDistance > 0 && pathIndex < cached.path.length) {
      const targetWaypoint = cached.path[pathIndex];
      const segmentDistance = this.calculateDistance(currentPos, targetWaypoint);

      if (segmentDistance <= remainingDistance) {
        // Can reach this waypoint
        currentPos = [...targetWaypoint] as [number, number];
        remainingDistance -= segmentDistance;
        pathIndex++;
      } else {
        // Move partway to this waypoint
        const ratio = remainingDistance / segmentDistance;
        currentPos = this.interpolatePosition(currentPos, targetWaypoint, ratio);
        remainingDistance = 0;
      }
    }

    // Update cache with new current index
    cached.currentIndex = pathIndex;

    const completed = pathIndex >= cached.path.length;
    const remainingPath = completed ? [] : cached.path.slice(pathIndex);

    return {
      newPosition: currentPos,
      remainingPath,
      completed
    };
  }

  private executeDirectMovement(
    start: [number, number],
    target: [number, number],
    maxDistance: number
  ): MovementResult {
    // Direct movement blocked - units must use transportation network only
    console.warn('Direct movement blocked in OptimizedNavigationModel');
    return {
      newPosition: [...start] as [number, number],
      remainingPath: [],
      completed: false
    };
  }

  private interpolatePosition(
    start: [number, number],
    end: [number, number],
    ratio: number
  ): [number, number] {
    const lng = start[0] + (end[0] - start[0]) * ratio;
    const lat = start[1] + (end[1] - start[1]) * ratio;
    return [lng, lat];
  }

  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = pos1[1] * Math.PI / 180;
    const φ2 = pos2[1] * Math.PI / 180;
    const Δφ = (pos2[1] - pos1[1]) * Math.PI / 180;
    const Δλ = (pos2[0] - pos1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private invalidateCache(miniatureId: string): void {
    const cached = this.navigationCache[miniatureId];
    if (cached) {
      cached.isValid = false;
    }
  }

  /**
   * Create a simple fallback path when pathfinding fails
   */
  private createFallbackPath(miniatureId: string, start: [number, number], target: [number, number]): void {
    console.warn(`Creating fallback path for ${miniatureId}`);

    // Create a simple direct path with a few waypoints
    const path: [number, number][] = [
      [...start] as [number, number],
      [...target] as [number, number]
    ];

    this.navigationCache[miniatureId] = {
      target: [...target],
      path,
      currentIndex: 0,
      lastUpdate: Date.now(),
      lastRecalculation: Date.now(),
      isValid: true
    };

    console.log(`Fallback path created for ${miniatureId}: ${path.length} waypoints`);
  }
}

// Singleton instance for the game
let navigationInstance: OptimizedNavigationModel | null = null;

export function getOptimizedNavigation(): OptimizedNavigationModel {
  if (!navigationInstance) {
    navigationInstance = new OptimizedNavigationModel();
  }
  return navigationInstance;
}

export function initializeOptimizedNavigation(
  bounds: [number, number, number, number],
  styleUrl: string
): Promise<void> {
  const navigation = getOptimizedNavigation();
  return navigation.initialize(bounds, styleUrl);
}