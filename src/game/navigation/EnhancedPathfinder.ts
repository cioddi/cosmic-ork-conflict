// Enhanced pathfinding manager with Web Workers and intelligent caching
import type BuildingNavigationModel from './BuildingNavigationModel';

interface PathfindingRequest {
  id: string;
  start: [number, number];
  goal: [number, number];
  timestamp: number;
}

interface PathfindingResult {
  id: string;
  path: [number, number][];
  timestamp: number;
  success: boolean;
}

interface CachedPath {
  id: string;
  start: [number, number];
  goal: [number, number];
  path: [number, number][];
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

interface PendingRequest {
  id: string;
  resolve: (path: [number, number][]) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class EnhancedPathfinder {
  private worker: Worker | null = null;
  private navigationModel: BuildingNavigationModel | null = null;
  private pathCache = new Map<string, CachedPath>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestQueue: PathfindingRequest[] = [];
  private isWorkerReady = false;
  private useWebGPU = false;
  private processingQueue = false;

  // Configuration
  private readonly CACHE_MAX_SIZE = 1000;
  private readonly CACHE_MAX_AGE_MS = 300000; // 5 minutes
  private readonly PATH_TOLERANCE_METERS = 5; // Reuse paths within 5m
  private readonly BATCH_PROCESS_INTERVAL_MS = 16; // ~60fps
  private readonly MAX_CONCURRENT_REQUESTS = 4;
  private activeRequests = 0;

  constructor() {
    this.initializeWorker();
    this.startQueueProcessor();
    this.startCacheCleanup();
  }

  private initializeWorker(): void {
    try {
      // Create worker from the PathfindingWorker module
      const workerBlob = new Blob([`
        importScripts('${window.location.origin}/pathfinding-worker.js');
      `], { type: 'application/javascript' });

      this.worker = new Worker(URL.createObjectURL(workerBlob));

      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event);
      };

      this.worker.onerror = (error) => {
        console.error('Pathfinding worker error:', error);
        this.isWorkerReady = false;
      };

    } catch (error) {
      console.warn('Failed to create pathfinding worker, using main thread fallback:', error);
      this.worker = null;
    }
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'initialized':
        this.isWorkerReady = true;
        this.useWebGPU = data.webgpu || false;
        console.log(`Enhanced pathfinder ready (WebGPU: ${this.useWebGPU})`);
        this.processQueuedRequests();
        break;

      case 'pathFound':
        this.handlePathResult(data as PathfindingResult);
        break;

      case 'error':
        console.error('Worker error:', data);
        break;
    }
  }

  private handlePathResult(result: PathfindingResult): void {
    this.activeRequests--;

    const pending = this.pendingRequests.get(result.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(result.id);

    if (result.success && result.path.length > 0) {
      // Cache the successful result
      this.cachePathResult(result);
      pending.resolve(result.path);
    } else {
      // For failed results, try to use fallback or return empty path
      pending.resolve([]);
    }

    // Process next items in queue
    this.processQueuedRequests();
  }

  private cachePathResult(result: PathfindingResult): void {
    const cacheKey = this.generateCacheKey(
      result.path[0] || [0, 0],
      result.path[result.path.length - 1] || [0, 0]
    );

    const cachedPath: CachedPath = {
      id: result.id,
      start: result.path[0] || [0, 0],
      goal: result.path[result.path.length - 1] || [0, 0],
      path: result.path,
      timestamp: result.timestamp,
      lastAccessed: Date.now(),
      accessCount: 1
    };

    this.pathCache.set(cacheKey, cachedPath);

    // Manage cache size
    this.enforceCacheLimit();
  }

  private generateCacheKey(start: [number, number], goal: [number, number]): string {
    // Round coordinates to reduce cache fragmentation
    const roundedStart = [
      Math.round(start[0] / this.PATH_TOLERANCE_METERS) * this.PATH_TOLERANCE_METERS,
      Math.round(start[1] / this.PATH_TOLERANCE_METERS) * this.PATH_TOLERANCE_METERS
    ];
    const roundedGoal = [
      Math.round(goal[0] / this.PATH_TOLERANCE_METERS) * this.PATH_TOLERANCE_METERS,
      Math.round(goal[1] / this.PATH_TOLERANCE_METERS) * this.PATH_TOLERANCE_METERS
    ];

    return `${roundedStart[0]},${roundedStart[1]}->${roundedGoal[0]},${roundedGoal[1]}`;
  }

  private findCachedPath(start: [number, number], goal: [number, number]): [number, number][] | null {
    const cacheKey = this.generateCacheKey(start, goal);
    const cached = this.pathCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_MAX_AGE_MS) {
      this.pathCache.delete(cacheKey);
      return null;
    }

    // Update access statistics
    cached.lastAccessed = Date.now();
    cached.accessCount++;

    return [...cached.path]; // Return a copy
  }

  private enforceCacheLimit(): void {
    if (this.pathCache.size <= this.CACHE_MAX_SIZE) {
      return;
    }

    // Remove least recently used entries
    const entries = Array.from(this.pathCache.entries());
    entries.sort((a, b) => {
      // Sort by last accessed time (oldest first)
      return a[1].lastAccessed - b[1].lastAccessed;
    });

    const toRemove = Math.floor(this.CACHE_MAX_SIZE * 0.2); // Remove 20% of cache
    for (let i = 0; i < toRemove; i++) {
      this.pathCache.delete(entries[i][0]);
    }
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processingQueue) {
        this.processQueuedRequests();
      }
    }, this.BATCH_PROCESS_INTERVAL_MS);
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every minute
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.pathCache.entries());
      for (const [key, cached] of entries) {
        const age = now - cached.timestamp;
        if (age > this.CACHE_MAX_AGE_MS) {
          this.pathCache.delete(key);
        }
      }
    }, 60000);
  }

  private async processQueuedRequests(): Promise<void> {
    if (!this.isWorkerReady || this.processingQueue || !this.worker) {
      return;
    }

    this.processingQueue = true;

    try {
      while (
        this.requestQueue.length > 0 &&
        this.activeRequests < this.MAX_CONCURRENT_REQUESTS
      ) {
        const request = this.requestQueue.shift();
        if (!request) break;

        // Check if request is still valid (not too old)
        const age = Date.now() - request.timestamp;
        if (age > 5000) { // Skip requests older than 5 seconds
          const pending = this.pendingRequests.get(request.id);
          if (pending) {
            pending.resolve([]);
            this.pendingRequests.delete(request.id);
          }
          continue;
        }

        this.activeRequests++;
        this.worker.postMessage({
          type: 'findPath',
          data: request
        });
      }
    } finally {
      this.processingQueue = false;
    }
  }

  public updateNavigationModel(navigationModel: BuildingNavigationModel): void {
    this.navigationModel = navigationModel;

    if (this.worker && this.isWorkerReady) {
      // Send the navigation model to the worker
      this.worker.postMessage({
        type: 'updateGrid',
        data: {
          bounds: (navigationModel as any).bounds,
          cellSize: (navigationModel as any).cellSize,
          grid: (navigationModel as any).grid,
          findPath: null // Remove the function reference
        }
      });
    }

    // Clear cache when navigation model changes
    this.pathCache.clear();
  }

  public async findPath(
    start: [number, number],
    goal: [number, number]
  ): Promise<[number, number][]> {
    // Check cache first
    const cachedPath = this.findCachedPath(start, goal);
    if (cachedPath) {
      return cachedPath;
    }

    // If no navigation model, return straight line
    if (!this.navigationModel) {
      return [start, goal];
    }

    // Create pathfinding request
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: PathfindingRequest = {
      id: requestId,
      start,
      goal,
      timestamp: Date.now()
    };

    // Create promise for the result
    return new Promise<[number, number][]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Timeout after 2 seconds - resolve with fallback
        this.pendingRequests.delete(requestId);
        if (this.navigationModel) {
          try {
            const fallbackPath = this.navigationModel.findPath(start, goal);
            resolve(fallbackPath);
          } catch (error) {
            resolve([start, goal]);
          }
        } else {
          resolve([start, goal]);
        }
      }, 2000);

      this.pendingRequests.set(requestId, {
        id: requestId,
        resolve: (path) => {
          clearTimeout(timeoutId);
          resolve(path);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: Date.now()
      });

      // Add to queue for processing
      if (this.isWorkerReady && this.worker) {
        this.requestQueue.push(request);
        this.processQueuedRequests();
      } else {
        // Fallback to main thread
        setTimeout(async () => {
          try {
            if (this.navigationModel) {
              const path = await this.navigationModel.findPath(start, goal);
              const pending = this.pendingRequests.get(requestId);
              if (pending) {
                pending.resolve(path);
              }
            }
          } catch (error) {
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
              pending.resolve([start, goal]);
            }
          }
        }, 0);
      }
    });
  }

  public getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    pendingRequests: number;
    queuedRequests: number;
    useWebGPU: boolean;
    isWorkerReady: boolean;
  } {
    return {
      cacheSize: this.pathCache.size,
      cacheHitRate: 0, // TODO: Track hit rate
      pendingRequests: this.pendingRequests.size,
      queuedRequests: this.requestQueue.length,
      useWebGPU: this.useWebGPU,
      isWorkerReady: this.isWorkerReady
    };
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'destroy', data: null });
      this.worker.terminate();
      this.worker = null;
    }

    this.pathCache.clear();
    this.pendingRequests.clear();
    this.requestQueue = [];
    this.isWorkerReady = false;
  }
}

export default EnhancedPathfinder;