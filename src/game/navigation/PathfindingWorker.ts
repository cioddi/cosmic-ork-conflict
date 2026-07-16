// Web Worker for background pathfinding
import { type GridData, type PathfindingRequest, type PathfindingResult } from './WebGPUPathfinder.disabled';

interface WorkerMessage {
  type: 'init' | 'updateGrid' | 'findPath' | 'destroy';
  data: any;
}

interface WorkerResponse {
  type: 'initialized' | 'pathFound' | 'error';
  data: any;
}

class PathfindingWorkerHandler {
  private webgpuPathfinder: any = null;
  private cpuPathfinder: any = null; // Fallback CPU pathfinder
  private useWebGPU = false;
  private gridData: GridData | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // WebGPU pathfinder disabled for now
      this.webgpuPathfinder = null;
      this.useWebGPU = false;

      if (this.useWebGPU) {
        console.log('Worker: WebGPU pathfinding initialized');
      } else {
        console.log('Worker: Falling back to CPU pathfinding');
      }

      self.postMessage({
        type: 'initialized',
        data: { webgpu: this.useWebGPU }
      } as WorkerResponse);
    } catch (error) {
      console.error('Worker: Initialization failed:', error);
      self.postMessage({
        type: 'error',
        data: { message: 'Initialization failed', error }
      } as WorkerResponse);
    }
  }

  private convertBuildingNavigationToGrid(navigationModel: any): GridData | null {
    try {
      // Extract grid data from BuildingNavigationModel
      const bounds = navigationModel.bounds;
      const cellSize = navigationModel.cellSize;
      const grid = navigationModel.grid;

      if (!bounds || !grid || !cellSize) {
        return null;
      }

      const width = grid[0]?.length || 0;
      const height = grid.length || 0;

      if (width === 0 || height === 0) {
        return null;
      }

      // Convert walkability data to Uint32Array
      const walkabilityData = new Uint32Array(width * height);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const index = row * width + col;
          walkabilityData[index] = grid[row][col].walkable ? 1 : 0;
        }
      }

      return {
        width,
        height,
        cellSize,
        offsetX: bounds[0], // minLon
        offsetY: bounds[1], // minLat
        walkabilityData
      };
    } catch (error) {
      console.error('Worker: Failed to convert navigation model:', error);
      return null;
    }
  }

  private async handleUpdateGrid(data: any): Promise<void> {
    try {
      // Convert navigation model to grid data
      this.gridData = this.convertBuildingNavigationToGrid(data);

      if (this.gridData && this.useWebGPU && this.webgpuPathfinder) {
        this.webgpuPathfinder.updateGrid(this.gridData);
      }

      // Store the original navigation model for CPU fallback
      this.cpuPathfinder = data;
    } catch (error) {
      console.error('Worker: Failed to update grid:', error);
    }
  }

  private async handleFindPath(request: PathfindingRequest): Promise<void> {
    try {
      let path: [number, number][] | null = null;

      // Try WebGPU first
      if (this.useWebGPU && this.webgpuPathfinder && this.gridData) {
        path = await this.webgpuPathfinder.findPath(request.start, request.goal);
      }

      // Fall back to CPU pathfinding if WebGPU fails or is not available
      if (!path && this.cpuPathfinder && this.cpuPathfinder.findPath) {
        try {
          path = this.cpuPathfinder.findPath(request.start, request.goal);
        } catch (error) {
          console.error('Worker: CPU pathfinding failed:', error);
          path = null;
        }
      }

      // Send result back to main thread
      const result: PathfindingResult = {
        id: request.id,
        path: path || [],
        timestamp: Date.now(),
        success: path !== null && path.length > 0
      };

      self.postMessage({
        type: 'pathFound',
        data: result
      } as WorkerResponse);
    } catch (error) {
      console.error('Worker: Pathfinding failed:', error);

      const result: PathfindingResult = {
        id: request.id,
        path: [],
        timestamp: Date.now(),
        success: false
      };

      self.postMessage({
        type: 'pathFound',
        data: result
      } as WorkerResponse);
    }
  }

  private handleDestroy(): void {
    if (this.webgpuPathfinder) {
      this.webgpuPathfinder.destroy();
      this.webgpuPathfinder = null;
    }
    this.cpuPathfinder = null;
    this.gridData = null;
    this.useWebGPU = false;
  }

  public handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, data } = event.data;

    switch (type) {
      case 'updateGrid':
        this.handleUpdateGrid(data);
        break;
      case 'findPath':
        this.handleFindPath(data);
        break;
      case 'destroy':
        this.handleDestroy();
        break;
      default:
        console.warn('Worker: Unknown message type:', type);
    }
  }
}

// Create worker handler instance
const workerHandler = new PathfindingWorkerHandler();

// Listen for messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  workerHandler.handleMessage(event);
};

export {}; // Make this a module