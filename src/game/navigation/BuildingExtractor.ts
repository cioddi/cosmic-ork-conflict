/**
 * BuildingExtractor - Extracts building polygons from vector tiles
 *
 * This extracts buildings from OpenMapTiles vector tiles and provides
 * spatial indexing for fast collision detection during pathfinding.
 */

import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import * as turf from '@turf/turf';
import type { Position } from 'geojson';

export interface BuildingPolygon {
  id: string;
  coordinates: Position[][];
  bounds: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
}

export interface SpatialCell {
  cellKey: string;
  buildingIds: string[];
}

export interface BuildingIndex {
  buildings: Map<string, BuildingPolygon>;
  spatialGrid: Map<string, string[]>; // cellKey -> building IDs
  gridSize: number;
  tiles: Array<{
    x: number;
    y: number;
    z: number;
    bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  }>;
}

export interface BuildingExtractorOptions {
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  zoom: number;
  styleUrl: string;
  gridSize?: number; // degrees, for spatial indexing
}

export class BuildingExtractor {
  private options: BuildingExtractorOptions;
  private index: BuildingIndex;

  constructor(options: BuildingExtractorOptions) {
    this.options = {
      ...options,
      gridSize: options.gridSize || 0.001, // ~100m at equator
    };

    this.index = {
      buildings: new Map(),
      spatialGrid: new Map(),
      gridSize: this.options.gridSize!,
      tiles: [],
    };
  }

  /**
   * Extract all buildings from vector tiles
   */
  async extractBuildings(): Promise<BuildingIndex> {
    const tiles = this.getTilesForBounds();
    let buildingCount = 0;
    let skippedCount = 0;
    let tilesWithBuildings = 0;
    let tilesWithoutBuildings = 0;

    // Store tiles in index for visualization
    this.index.tiles = tiles;

    console.log(`Processing ${tiles.length} tiles for buildings (zoom ${this.options.zoom})...`);

    for (let tileIndex = 0; tileIndex < tiles.length; tileIndex++) {
      const tile = tiles[tileIndex];

      // Log progress every 10 tiles
      if (tileIndex % 10 === 0) {
        console.log(`Processing tile ${tileIndex + 1}/${tiles.length} (${buildingCount} buildings so far)`);
      }
      try {
        const tileData = await this.fetchVectorTile(tile);

        // Log available layers for debugging
        const layerNames = Object.keys(tileData.layers);
        if (tileIndex === 0) {
          console.log(`Available layers in first tile: ${layerNames.join(', ')}`);
        }

        // Look for building layer
        const buildingLayer = (tileData.layers as any)['building'];

        if (!buildingLayer) {
          tilesWithoutBuildings++;
          continue;
        }

        tilesWithBuildings++;
        console.log(`Tile ${tile.z}/${tile.x}/${tile.y} has ${buildingLayer.length} building features`);

        for (let i = 0; i < buildingLayer.length; i++) {
          try {
            const feature = buildingLayer.feature(i);

            // Only process polygon features
            if (feature.type !== 3) { // Type 3 = Polygon
              continue;
            }

            const geometry = feature.loadGeometry();

            // Skip invalid geometry
            if (!geometry || geometry.length === 0) {
              skippedCount++;
              continue;
            }

            // Convert tile coordinates to lng/lat
            const coordinates = geometry.map((ring: any[]) =>
              this.tileCoordsToLngLat(ring, tile)
            );

            // Skip buildings with invalid coordinates
            if (coordinates.length === 0 || coordinates[0].length < 3) {
              skippedCount++;
              continue;
            }

            // Simplify the polygon to reduce complexity
            const simplified = this.simplifyPolygon(coordinates);

            // Skip if too simplified
            if (simplified.length === 0 || simplified[0].length < 3) {
              skippedCount++;
              continue;
            }

            // Create building polygon
            const building: BuildingPolygon = {
              id: `b_${tile.z}_${tile.x}_${tile.y}_${i}`,
              coordinates: simplified,
              bounds: this.calculateBounds(simplified),
            };

            // Add to index
            this.index.buildings.set(building.id, building);

            // Add to spatial grid
            this.addToSpatialGrid(building);

            buildingCount++;
          } catch (featureError) {
            // Skip problematic features
            skippedCount++;
            continue;
          }
        }
      } catch (error) {
        console.warn(`Skipping tile ${tile.z}/${tile.x}/${tile.y}:`, error);
      }
    }

    console.log(`Extracted ${buildingCount} buildings (skipped ${skippedCount} invalid)`);
    console.log(`Tiles: ${tilesWithBuildings} with buildings, ${tilesWithoutBuildings} without buildings`);
    return this.index;
  }

  /**
   * Get buildings near a point or line segment
   */
  getBuildingsNear(
    position: [number, number],
    radius: number = 0.001 // ~100m in degrees
  ): BuildingPolygon[] {
    const cells = this.getCellsInRadius(position, radius);
    const buildingIds = new Set<string>();

    for (const cellKey of cells) {
      const ids = this.index.spatialGrid.get(cellKey) || [];
      ids.forEach(id => buildingIds.add(id));
    }

    return Array.from(buildingIds)
      .map(id => this.index.buildings.get(id))
      .filter((b): b is BuildingPolygon => b !== undefined);
  }

  /**
   * Check if a line segment intersects any buildings
   */
  checkLineIntersection(
    from: [number, number],
    to: [number, number]
  ): { intersects: boolean; buildings: BuildingPolygon[] } {
    // Get all cells the line passes through
    const cells = this.getCellsAlongLine(from, to);
    const potentialBuildings = new Set<string>();

    for (const cellKey of cells) {
      const ids = this.index.spatialGrid.get(cellKey) || [];
      ids.forEach(id => potentialBuildings.add(id));
    }

    // Check each building for intersection
    const line = turf.lineString([from, to]);
    const intersectingBuildings: BuildingPolygon[] = [];

    for (const buildingId of Array.from(potentialBuildings)) {
      const building = this.index.buildings.get(buildingId);
      if (!building) continue;

      // Quick bounds check first
      if (!this.lineBoundsIntersect(from, to, building.bounds)) {
        continue;
      }

      // Precise intersection check
      const polygon = turf.polygon(building.coordinates);

      try {
        // @ts-ignore - booleanIntersects exists but TypeScript definition is missing
        if (turf.booleanIntersects(line, polygon)) {
          intersectingBuildings.push(building);
        }
      } catch {
        // Fallback to booleanOverlap if booleanIntersects not available
        if (turf.booleanOverlap(line, polygon)) {
          intersectingBuildings.push(building);
        }
      }
    }

    return {
      intersects: intersectingBuildings.length > 0,
      buildings: intersectingBuildings,
    };
  }

  /**
   * Get corner waypoints for navigating around a building
   */
  getBuildingCorners(building: BuildingPolygon): [number, number][] {
    // Return outer ring corners
    const outerRing = building.coordinates[0];
    return outerRing.map(coord => [coord[0], coord[1]] as [number, number]);
  }

  // Private utility methods

  /**
   * Simplify polygon to reduce vertex count
   */
  private simplifyPolygon(coordinates: Position[][]): Position[][] {
    // Don't simplify if already simple
    const totalVertices = coordinates.reduce((sum, ring) => sum + ring.length, 0);
    if (totalVertices < 10) {
      return coordinates;
    }

    try {
      // Use Turf to simplify
      const polygon = turf.polygon(coordinates);
      const simplified = turf.simplify(polygon, {
        tolerance: 0.000005, // ~0.5m tolerance
        highQuality: false,
      });

      return simplified.geometry.coordinates as Position[][];
    } catch (error) {
      // If simplification fails, return original
      return coordinates;
    }
  }

  private getTilesForBounds() {
    const { bounds, zoom } = this.options;
    const MAX_ZOOM = 14;
    const effectiveZoom = Math.min(zoom, MAX_ZOOM);
    const tiles = [];

    const minTileX = this.lngToTileX(bounds[0], effectiveZoom);
    const maxTileX = this.lngToTileX(bounds[2], effectiveZoom);
    const minTileY = this.latToTileY(bounds[3], effectiveZoom);
    const maxTileY = this.latToTileY(bounds[1], effectiveZoom);

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        const tileBounds = this.getTileBounds(x, y, effectiveZoom);
        tiles.push({
          x,
          y,
          z: effectiveZoom,
          bounds: tileBounds
        });
      }
    }

    return tiles;
  }

  private getTileBounds(x: number, y: number, z: number): [number, number, number, number] {
    const n = Math.pow(2, z);
    const minLng = (x / n) * 360 - 180;
    const maxLng = ((x + 1) / n) * 360 - 180;

    const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
    const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const minLat = (minLatRad * 180) / Math.PI;
    const maxLat = (maxLatRad * 180) / Math.PI;

    return [minLng, minLat, maxLng, maxLat];
  }

  private lngToTileX(lng: number, zoom: number): number {
    return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  }

  private latToTileY(lat: number, zoom: number): number {
    return Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom)
    );
  }

  private async fetchVectorTile(tile: { x: number; y: number; z: number }) {
    const tileUrl = `https://wms.wheregroup.com/tileserver/tile/world-0-14/${tile.z}/${tile.x}/${tile.y}.pbf`;

    try {
      const response = await fetch(tileUrl, {
        referrer: window.location.origin + '/',
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pbf = new Pbf(new Uint8Array(arrayBuffer));
      const vectorTile = new VectorTile(pbf);

      return { layers: vectorTile.layers };
    } catch (error) {
      console.error(`Failed to fetch tile ${tile.z}/${tile.x}/${tile.y}:`, error);
      return { layers: {} };
    }
  }

  private tileCoordsToLngLat(
    coords: any[],
    tile: { x: number; y: number; z: number }
  ): Position[] {
    const extent = 4096;

    return coords.map(coord => {
      const x = coord.x / extent;
      const y = coord.y / extent;

      const worldX = tile.x + x;
      const worldY = tile.y + y;

      const n = Math.pow(2, tile.z);
      const lng = (worldX / n) * 360 - 180;
      const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / n)));
      const lat = (latRad * 180) / Math.PI;

      return [lng, lat];
    });
  }

  private calculateBounds(coordinates: Position[][]): BuildingPolygon['bounds'] {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const ring of coordinates) {
      for (const coord of ring) {
        minLng = Math.min(minLng, coord[0]);
        maxLng = Math.max(maxLng, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
      }
    }

    return { minLng, maxLng, minLat, maxLat };
  }

  private addToSpatialGrid(building: BuildingPolygon): void {
    const { bounds } = building;
    const { gridSize } = this.index;

    // Add to all cells the building overlaps
    const minCellX = Math.floor(bounds.minLng / gridSize);
    const maxCellX = Math.floor(bounds.maxLng / gridSize);
    const minCellY = Math.floor(bounds.minLat / gridSize);
    const maxCellY = Math.floor(bounds.maxLat / gridSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        const cellKey = `${x},${y}`;

        if (!this.index.spatialGrid.has(cellKey)) {
          this.index.spatialGrid.set(cellKey, []);
        }

        this.index.spatialGrid.get(cellKey)!.push(building.id);
      }
    }
  }

  private getCellKey(lng: number, lat: number): string {
    const { gridSize } = this.index;
    const x = Math.floor(lng / gridSize);
    const y = Math.floor(lat / gridSize);
    return `${x},${y}`;
  }

  private getCellsInRadius(
    center: [number, number],
    radius: number
  ): string[] {
    const { gridSize } = this.index;
    const cellRadius = Math.ceil(radius / gridSize);
    const centerX = Math.floor(center[0] / gridSize);
    const centerY = Math.floor(center[1] / gridSize);

    const cells: string[] = [];

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        cells.push(`${centerX + dx},${centerY + dy}`);
      }
    }

    return cells;
  }

  private getCellsAlongLine(
    from: [number, number],
    to: [number, number]
  ): string[] {
    const { gridSize } = this.index;

    // Use Bresenham-like algorithm for cells
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

  private lineBoundsIntersect(
    from: [number, number],
    to: [number, number],
    bounds: BuildingPolygon['bounds']
  ): boolean {
    const lineMinLng = Math.min(from[0], to[0]);
    const lineMaxLng = Math.max(from[0], to[0]);
    const lineMinLat = Math.min(from[1], to[1]);
    const lineMaxLat = Math.max(from[1], to[1]);

    return !(
      lineMaxLng < bounds.minLng ||
      lineMinLng > bounds.maxLng ||
      lineMaxLat < bounds.minLat ||
      lineMinLat > bounds.maxLat
    );
  }

  /**
   * Get the index for external use
   */
  getIndex(): BuildingIndex {
    return this.index;
  }
}
