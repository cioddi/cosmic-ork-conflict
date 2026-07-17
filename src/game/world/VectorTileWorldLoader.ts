import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { GameWorld } from "./GameWorld";
import { LocalProjection } from "./LocalProjection";
import {
  boundsIntersect,
  expandBounds,
  geographicBounds,
  normalizeRing,
  projectGeographicPolygon,
  worldBoundsForPoints,
} from "./geometry";
import {
  GeographicPoint,
  TileCoordinate,
  TileFetcher,
  WorldDefinition,
  WorldPolygon,
} from "./types";

export class FetchTileFetcher implements TileFetcher {
  async fetchTile(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const response = await fetch(url, { signal, credentials: "omit" });
    if (!response.ok) throw new Error(`Tile request failed (${response.status}): ${url}`);
    return response.arrayBuffer();
  }
}

export class VectorTileWorldLoader {
  constructor(private readonly tileFetcher: TileFetcher = new FetchTileFetcher()) {}

  async load(definition: WorldDefinition, signal?: AbortSignal): Promise<GameWorld> {
    const geographic = geographicBounds([
      definition.playableArea,
      ...definition.setupAreas,
    ]);
    const origin: GeographicPoint = [
      (geographic[0] + geographic[2]) / 2,
      (geographic[1] + geographic[3]) / 2,
    ];
    const projection = new LocalProjection(origin);
    const playableArea = projectGeographicPolygon(
      definition.playableArea,
      projection,
      "playable-area"
    );
    const setupAreas = definition.setupAreas.map((area, index) =>
      projectGeographicPolygon(area, projection, `setup-area-${index}`)
    );
    const routingBounds = expandBounds(
      worldBoundsForPoints(playableArea.outer),
      definition.routingPaddingMeters
    );
    const southwest = projection.unproject([routingBounds.minX, routingBounds.minY]);
    const northeast = projection.unproject([routingBounds.maxX, routingBounds.maxY]);
    const tiles = tilesForBounds(
      [southwest[0], southwest[1], northeast[0], northeast[1]],
      definition.tileSource.zoom
    );
    const obstacleGroups = await mapConcurrent(
      tiles,
      definition.tileSource.maxConcurrentRequests ?? 6,
      (tile) => this.loadTile(definition, tile, projection, signal)
    );
    const obstacles = obstacleGroups
      .flat()
      .filter((obstacle) => boundsIntersect(obstacle.bounds, routingBounds));
    if (obstacles.length === 0) {
      throw new Error("World loading produced no building obstacles");
    }
    return new GameWorld({
      definition,
      projection,
      routingBounds,
      playableArea,
      setupAreas,
      obstacles,
    });
  }

  private async loadTile(
    definition: WorldDefinition,
    tile: TileCoordinate,
    projection: LocalProjection,
    signal?: AbortSignal
  ): Promise<WorldPolygon[]> {
    const url = renderTileUrl(definition.tileSource.urlTemplate, tile);
    const retryCount = definition.tileSource.retryCount ?? 2;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const buffer = await this.tileFetcher.fetchTile(url, signal);
        return decodeBuildings(
          buffer,
          tile,
          definition.tileSource.sourceLayer,
          projection
        );
      } catch (error) {
        lastError = error;
        if (signal?.aborted) throw error;
      }
    }
    throw new Error(`Unable to load required world tile ${tile.z}/${tile.x}/${tile.y}`, {
      cause: lastError,
    });
  }
}

export function decodeBuildings(
  buffer: ArrayBuffer,
  tileCoordinate: TileCoordinate,
  sourceLayer: string,
  projection: LocalProjection
): WorldPolygon[] {
  const tile = new VectorTile(new PbfReader(new Uint8Array(buffer)));
  const layer = tile.layers[sourceLayer];
  if (!layer) return [];
  const result: WorldPolygon[] = [];
  for (let index = 0; index < layer.length; index++) {
    const feature = layer.feature(index);
    if (feature.type !== 3) continue;
    const geojson = feature.toGeoJSON(
      tileCoordinate.x,
      tileCoordinate.y,
      tileCoordinate.z
    ) as {
      geometry?: {
        type: "Polygon" | "MultiPolygon";
        coordinates: number[][][] | number[][][][];
      };
    };
    if (!geojson.geometry) continue;
    const polygons =
      geojson.geometry.type === "Polygon"
        ? [geojson.geometry.coordinates as number[][][]]
        : (geojson.geometry.coordinates as number[][][][]);
    polygons.forEach((coordinates, polygonIndex) => {
      try {
        const rings = coordinates.map((ring) =>
          normalizeRing(
            ring.map((point) =>
              projection.project([point[0], point[1]] as GeographicPoint)
            )
          )
        );
        const outer = rings[0];
        if (!outer) return;
        result.push({
          id: `${tileCoordinate.z}/${tileCoordinate.x}/${tileCoordinate.y}/${index}/${polygonIndex}`,
          outer,
          holes: rings.slice(1),
          bounds: worldBoundsForPoints(outer),
        });
      } catch {
        // Individual malformed features do not invalidate otherwise complete tiles.
      }
    });
  }
  return result;
}

export function tilesForBounds(
  bounds: readonly [number, number, number, number],
  zoom: number
): TileCoordinate[] {
  const minX = longitudeToTileX(bounds[0], zoom);
  const maxX = longitudeToTileX(bounds[2], zoom);
  const minY = latitudeToTileY(bounds[3], zoom);
  const maxY = latitudeToTileY(bounds[1], zoom);
  const tiles: TileCoordinate[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) tiles.push({ z: zoom, x, y });
  }
  return tiles;
}

export function renderTileUrl(template: string, tile: TileCoordinate): string {
  const tmsY = 2 ** tile.z - 1 - tile.y;
  return template
    .replace(/\{z\}/g, String(tile.z))
    .replace(/\{x\}/g, String(tile.x))
    .replace(/\{y\}/g, String(tile.y))
    .replace(/\{-y\}/g, String(tmsY))
    .replace(/\{s\}/g, "a");
}

function longitudeToTileX(longitude: number, zoom: number): number {
  const count = 2 ** zoom;
  return Math.max(0, Math.min(count - 1, Math.floor(((longitude + 180) / 360) * count)));
}

function latitudeToTileY(latitude: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (clamped * Math.PI) / 180;
  const count = 2 ** zoom;
  return Math.max(
    0,
    Math.min(
      count - 1,
      Math.floor(
        ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) /
          2) *
          count
      )
    )
  );
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, values.length)) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        result[index] = await mapper(values[index]);
      }
    }
  );
  await Promise.all(workers);
  return result;
}
