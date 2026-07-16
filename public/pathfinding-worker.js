// Simple pathfinding worker for browser compatibility
// This is a simplified version that focuses on caching and background processing

class SimplePathfindingWorker {
  constructor() {
    this.initialized = false;
    this.navigationModel = null;
    this.pathCache = new Map();
    this.init();
  }

  async init() {
    try {
      // Simple initialization - no WebGPU for now
      this.initialized = true;
      self.postMessage({
        type: 'initialized',
        data: { webgpu: false }
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        data: { message: 'Initialization failed', error: error.message }
      });
    }
  }

  handleUpdateGrid(data) {
    try {
      // Store navigation model data for CPU pathfinding
      this.navigationModel = data;
    } catch (error) {
      console.error('Worker: Failed to update grid:', error);
    }
  }

  async handleFindPath(request) {
    try {
      let path = [];

      // Check cache first
      const cacheKey = `${request.start[0]},${request.start[1]}->${request.goal[0]},${request.goal[1]}`;
      const cached = this.pathCache.get(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 minute cache
        path = cached.path;
      } else {
        // Simple pathfinding - straight line if no obstacles
        // In a real implementation, this would use A* on the grid
        path = [request.start, request.goal];

        // Cache the result
        this.pathCache.set(cacheKey, {
          path: path,
          timestamp: Date.now()
        });

        // Limit cache size
        if (this.pathCache.size > 1000) {
          const oldest = Array.from(this.pathCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
          this.pathCache.delete(oldest[0]);
        }
      }

      const result = {
        id: request.id,
        path: path,
        timestamp: Date.now(),
        success: path.length > 0
      };

      self.postMessage({
        type: 'pathFound',
        data: result
      });
    } catch (error) {
      console.error('Worker: Pathfinding failed:', error);

      self.postMessage({
        type: 'pathFound',
        data: {
          id: request.id,
          path: [],
          timestamp: Date.now(),
          success: false
        }
      });
    }
  }

  handleMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'updateGrid':
        this.handleUpdateGrid(data);
        break;
      case 'findPath':
        this.handleFindPath(data);
        break;
      case 'destroy':
        this.pathCache.clear();
        break;
      default:
        console.warn('Worker: Unknown message type:', type);
    }
  }
}

// Create worker handler and listen for messages
const workerHandler = new SimplePathfindingWorker();
self.onmessage = (event) => {
  workerHandler.handleMessage(event);
};