/**
 * Web Worker for pathfinding operations
 * Keeps pathfinding off the main thread for better performance
 */

import { PathNetwork, NetworkPathfinder } from './PathNetwork';

export interface PathfindingRequest {
  id: string;
  type: 'findPath' | 'initNetwork';
  start?: [number, number];
  end?: [number, number];
  network?: PathNetwork;
}

export interface PathfindingResponse {
  id: string;
  type: 'pathFound' | 'networkInitialized' | 'error';
  path?: [number, number][];
  error?: string;
}

class PathfindingWorkerClass {
  private pathfinder: NetworkPathfinder | null = null;

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent<PathfindingRequest>) {
    const request = event.data;

    try {
      switch (request.type) {
        case 'initNetwork':
          this.initializeNetwork(request);
          break;

        case 'findPath':
          this.findPath(request);
          break;

        default:
          this.sendError(request.id, `Unknown request type: ${request.type}`);
      }
    } catch (error) {
      this.sendError(request.id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private initializeNetwork(request: PathfindingRequest) {
    if (!request.network) {
      this.sendError(request.id, 'Network data is required for initialization');
      return;
    }

    // Reconstruct the network object with proper Map instances
    const network: PathNetwork = {
      nodes: new Map(Object.entries(request.network.nodes || {})),
      spatialIndex: {
        gridSize: request.network.spatialIndex.gridSize,
        cells: new Map(Object.entries(request.network.spatialIndex.cells || {}))
      },
      bounds: request.network.bounds
    };

    this.pathfinder = new NetworkPathfinder(network);

    const response: PathfindingResponse = {
      id: request.id,
      type: 'networkInitialized'
    };

    self.postMessage(response);
  }

  private findPath(request: PathfindingRequest) {
    if (!this.pathfinder) {
      this.sendError(request.id, 'Pathfinder not initialized');
      return;
    }

    if (!request.start || !request.end) {
      this.sendError(request.id, 'Start and end positions are required');
      return;
    }

    const path = this.pathfinder.findPath(request.start, request.end);

    const response: PathfindingResponse = {
      id: request.id,
      type: 'pathFound',
      path
    };

    self.postMessage(response);
  }

  private sendError(id: string, message: string) {
    const response: PathfindingResponse = {
      id,
      type: 'error',
      error: message
    };

    self.postMessage(response);
  }
}

// Initialize the worker
new PathfindingWorkerClass();
