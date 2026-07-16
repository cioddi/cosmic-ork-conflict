export type GeographicPoint = readonly [longitude: number, latitude: number];
export type WorldPoint = [x: number, y: number];
export type WorldRing = readonly WorldPoint[];

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WorldPolygon {
  id: string;
  outer: WorldRing;
  holes: readonly WorldRing[];
  bounds: WorldBounds;
}

export interface GeographicPolygon {
  outer: readonly GeographicPoint[];
  holes?: readonly (readonly GeographicPoint[])[];
}

export interface MobilityProfile {
  id: string;
  clearanceMeters: number;
}

export interface VectorTileSourceDefinition {
  urlTemplate: string;
  sourceLayer: string;
  zoom: number;
  maxConcurrentRequests?: number;
  retryCount?: number;
}

export interface WorldDefinition {
  id: string;
  version: string;
  playableArea: GeographicPolygon;
  setupAreas: readonly GeographicPolygon[];
  routingPaddingMeters: number;
  navigationCellSizeMeters: number;
  spatialIndexCellSizeMeters: number;
  mobilityProfiles: readonly MobilityProfile[];
  tileSource: VectorTileSourceDefinition;
}

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface TileFetcher {
  fetchTile(
    url: string,
    signal?: AbortSignal
  ): Promise<ArrayBuffer>;
}
