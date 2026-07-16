// WebGPU pathfinder - temporarily disabled due to type issues
// Force refresh
// This file will be re-enabled once WebGPU types are properly configured

export default class WebGPUPathfinderDisabled {
  async initialize(): Promise<boolean> {
    console.log('WebGPU pathfinder disabled - using CPU fallback');
    return false;
  }

  updateGrid(): void {
    // No-op
  }

  async findPath(): Promise<[number, number][] | null> {
    return null;
  }

  destroy(): void {
    // No-op
  }
}

// Type definitions
export interface GridData {
  width: number;
  height: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;
  walkabilityData: Uint32Array;
}

export interface PathfindingRequest {
  id: string;
  start: [number, number];
  goal: [number, number];
  timestamp: number;
}

export interface PathfindingResult {
  id: string;
  path: [number, number][];
  timestamp: number;
  success: boolean;
}