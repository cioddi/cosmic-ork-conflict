/**
 * PathfindingManager - Manages pathfinding requests and caching
 * Provides efficient pathfinding with worker-based computation and smart caching
 */

import {
  NetworkPathfinder,
  PathNetwork,
  PathNetworkGenerator,
  NetworkGenerationOptions,
} from './PathNetwork';
import { PathfindingRequest, PathfindingResponse } from './PathfindingWorker.worker';

export interface PathCache {
  [key: string]: {
    path: [number, number][];
    timestamp: number;
    cost: number;
  };
}

export interface PathfindingManagerOptions {
  cacheTimeout: number; // milliseconds
  maxCacheSize: number;
  workerPoolSize: number;
}

export class PathfindingManager {
  private network: PathNetwork | null = null;
  private workers: Worker[] = [];
  private pathCache: PathCache = {};
  private pendingRequests: Map<string, {
    resolve: (path: [number, number][]) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private requestIdCounter = 0;
  private options: PathfindingManagerOptions;
  private isInitialized = false;

  constructor(options: Partial<PathfindingManagerOptions> = {}) {
    this.options = {
      cacheTimeout: 30000, // 30 seconds
      maxCacheSize: 1000,
      workerPoolSize: 2,
      ...options
    };
  }

  /**
   * Initialize the pathfinding system
   */
  async initialize(networkOptions: NetworkGenerationOptions): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing pathfinding manager...');

    // Generate the path network
    const generator = new PathNetworkGenerator(networkOptions);
    this.network = await generator.generateNetwork();

    // Initialize worker pool for background path updates
    await this.initializeWorkers();

    this.isInitialized = true;
    console.log('Pathfinding manager initialized successfully');
  }

  /**
   * Find a path between two points (synchronous for immediate needs)
   */
  findPathSync(start: [number, number], end: [number, number]): [number, number][] {
    if (!this.isInitialized || !this.network) {
      console.warn('Pathfinding manager not initialized');
      return [];
    }

    // Check cache first
    const cacheKey = this.getCacheKey(start, end);
    const cachedPath = this.getFromCache(cacheKey);

    if (cachedPath) {
      return cachedPath;
    }

    // For immediate needs, use direct pathfinding on main thread with timeout
    try {
      console.log(`Sync pathfinding from ${start} to ${end}`);

      // Use the fixed A* pathfinding with safeguards
      const pathfinder = new NetworkPathfinder(this.network);

      console.log('Starting A* pathfinding...');
      const startTime = Date.now();
      const path = pathfinder.findPath(start, end);
      const elapsed = Date.now() - startTime;

      console.log(`Pathfinding completed in ${elapsed}ms, found ${path.length} waypoints`);

      // If no path found, create simple fallback
      if (path.length === 0) {
        console.warn('No path found, using direct fallback');
        const fallbackPath: [number, number][] = [start, end];
        this.addToCache(cacheKey, fallbackPath);
        return fallbackPath;
      }

      // Cache the result
      this.addToCache(cacheKey, path);
      return path;
    } catch (error) {
      console.error('Sync pathfinding failed:', error);
      return [];
    }
  }

  /**
   * Find a path between two points (async for background updates)
   */
  async findPathAsync(start: [number, number], end: [number, number]): Promise<[number, number][]> {
    if (!this.isInitialized || !this.network) {
      throw new Error('Pathfinding manager not initialized');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(start, end);
    const cachedPath = this.getFromCache(cacheKey);

    if (cachedPath) {
      return cachedPath;
    }

    // Use sync pathfinding for now to avoid worker issues
    console.log('Using sync pathfinding for async request');
    return this.findPathSync(start, end);
  }

  /**
   * Legacy method for compatibility
   */
  async findPath(start: [number, number], end: [number, number]): Promise<[number, number][]> {
    return this.findPathAsync(start, end);
  }

  /**
   * Get path from cache if valid
   */
  private getFromCache(cacheKey: string): [number, number][] | null {
    const cached = this.pathCache[cacheKey];
    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.options.cacheTimeout) {
      delete this.pathCache[cacheKey];
      return null;
    }

    return cached.path;
  }

  /**
   * Add path to cache
   */
  private addToCache(cacheKey: string, path: [number, number][]): void {
    // Clean old entries if cache is full
    if (Object.keys(this.pathCache).length >= this.options.maxCacheSize) {
      this.cleanCache();
    }

    const cost = this.calculatePathCost(path);
    this.pathCache[cacheKey] = {
      path: [...path], // Deep copy
      timestamp: Date.now(),
      cost
    };
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of Object.entries(this.pathCache)) {
      const age = now - cached.timestamp;
      if (age > this.options.cacheTimeout) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      delete this.pathCache[key];
    }

    // If still too many entries, remove oldest ones
    const remainingKeys = Object.keys(this.pathCache);
    if (remainingKeys.length >= this.options.maxCacheSize) {
      const sortedKeys = remainingKeys.sort((a, b) =>
        this.pathCache[a].timestamp - this.pathCache[b].timestamp
      );

      const toRemove = sortedKeys.slice(0, remainingKeys.length - this.options.maxCacheSize + 100);
      for (const key of toRemove) {
        delete this.pathCache[key];
      }
    }
  }

  /**
   * Initialize worker pool
   */
  private async initializeWorkers(): Promise<void> {
    const workerInitPromises = [];

    for (let i = 0; i < this.options.workerPoolSize; i++) {
      try {
        const worker = new Worker(
          new URL('./PathfindingWorker.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = this.handleWorkerMessage.bind(this);

        // Initialize worker with network data
        const initRequest: PathfindingRequest = {
          id: `init_${i}`,
          type: 'initNetwork',
          network: this.serializeNetworkForWorker()
        };

        const initPromise = this.sendRequestToWorker(worker, initRequest);
        workerInitPromises.push(initPromise);

        this.workers.push(worker);
      } catch (error) {
        console.warn(`Failed to create worker ${i}:`, error);
      }
    }

    // Wait for all workers to initialize
    await Promise.all(workerInitPromises);
    console.log(`Initialized ${this.workers.length} pathfinding workers`);
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(event: MessageEvent<PathfindingResponse>) {
    const response = event.data;
    const pendingRequest = this.pendingRequests.get(response.id);

    if (!pendingRequest) {
      console.warn(`Received response for unknown request: ${response.id}`);
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.type === 'error') {
      pendingRequest.reject(new Error(response.error || 'Unknown pathfinding error'));
    } else if (response.type === 'pathFound' || response.type === 'networkInitialized') {
      pendingRequest.resolve(response.path || []);
    }
  }

  /**
   * Send request to worker and return promise
   */
  private sendRequestToWorker(worker: Worker, request: PathfindingRequest): Promise<[number, number][]> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Pathfinding request timeout'));
        }
      }, 5000);

      worker.postMessage(request);
    });
  }

  /**
   * Get an available worker (simple round-robin)
   */
  private getAvailableWorker(): Worker | null {
    if (this.workers.length === 0) {
      return null;
    }

    // Simple round-robin selection
    const index = this.requestIdCounter % this.workers.length;
    return this.workers[index];
  }

  /**
   * Serialize network for worker (convert Maps to objects)
   */
  private serializeNetworkForWorker(): any {
    if (!this.network) return null;

    return {
      nodes: Object.fromEntries(this.network.nodes),
      spatialIndex: {
        gridSize: this.network.spatialIndex.gridSize,
        cells: Object.fromEntries(this.network.spatialIndex.cells)
      },
      bounds: this.network.bounds
    };
  }

  /**
   * Generate cache key for start/end positions
   */
  private getCacheKey(start: [number, number], end: [number, number]): string {
    // Round to reasonable precision to increase cache hits
    const precision = 6; // ~1 meter precision
    const roundedStart = [
      Math.round(start[0] * 10**precision) / 10**precision,
      Math.round(start[1] * 10**precision) / 10**precision
    ];
    const roundedEnd = [
      Math.round(end[0] * 10**precision) / 10**precision,
      Math.round(end[1] * 10**precision) / 10**precision
    ];

    return `${roundedStart[0]},${roundedStart[1]}->${roundedEnd[0]},${roundedEnd[1]}`;
  }

  /**
   * Calculate cost of a path (for cache management)
   */
  private calculatePathCost(path: [number, number][]): number {
    if (path.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      totalDistance += this.calculateDistance(prev, curr);
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points
   */
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

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    const now = Date.now();
    const entries = Object.entries(this.pathCache);

    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([_, cached]) =>
        now - cached.timestamp <= this.options.cacheTimeout
      ).length,
      memoryUsage: JSON.stringify(this.pathCache).length,
      oldestEntry: Math.min(...entries.map(([_, cached]) => cached.timestamp)),
      newestEntry: Math.max(...entries.map(([_, cached]) => cached.timestamp))
    };
  }

  /**
   * Get network information for debugging
   */
  getNetworkInfo() {
    if (!this.network) {
      return { initialized: false };
    }

    return {
      initialized: true,
      nodeCount: this.network.nodes.size,
      spatialCells: this.network.spatialIndex.cells.size,
      bounds: this.network.bounds
    };
  }

  /**
   * Get the actual network for debugging visualization
   */
  getNetwork() {
    return this.network;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Terminate all workers
    for (const worker of this.workers) {
      worker.terminate();
    }

    this.workers = [];
    this.pathCache = {};
    this.pendingRequests.clear();
    this.isInitialized = false;
  }
}
