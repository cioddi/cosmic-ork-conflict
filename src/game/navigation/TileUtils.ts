import * as turf from "@turf/turf";

export type BBox = [number, number, number, number];

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

export interface MercatorPoint {
  x: number;
  y: number;
}

const EARTH_RADIUS = 6378137;
const MAX_LATITUDE = 85.0511287798;

export function clampLatitude(lat: number): number {
  return Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, lat));
}

export function lonLatToTile(lon: number, lat: number, zoom: number): {
  x: number;
  y: number;
} {
  const clampedLat = clampLatitude(lat);
  const latRad = (clampedLat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

export function tilesForBBox(bbox: BBox, zoom: number): TileCoord[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const topLeft = lonLatToTile(minLon, maxLat, zoom);
  const bottomRight = lonLatToTile(maxLon, minLat, zoom);

  const tiles: TileCoord[] = [];
  const startX = Math.min(topLeft.x, bottomRight.x);
  const endX = Math.max(topLeft.x, bottomRight.x);
  const startY = Math.min(topLeft.y, bottomRight.y);
  const endY = Math.max(topLeft.y, bottomRight.y);

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

export function expandBBox(bbox: BBox, meters: number): BBox {
  if (meters <= 0) {
    return bbox;
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bottomLeft = turf.point([minLon, minLat]);
  const topRight = turf.point([maxLon, maxLat]);

  const south = turf.destination(bottomLeft, meters, 180, { units: "meters" });
  const west = turf.destination(bottomLeft, meters, 270, { units: "meters" });
  const north = turf.destination(topRight, meters, 0, { units: "meters" });
  const east = turf.destination(topRight, meters, 90, { units: "meters" });

  return [
    west.geometry.coordinates[0],
    south.geometry.coordinates[1],
    east.geometry.coordinates[0],
    north.geometry.coordinates[1],
  ];
}

export function projectLonLatToMercator(lon: number, lat: number): MercatorPoint {
  const clampedLat = clampLatitude(lat);
  const x = (lon * Math.PI) / 180 * EARTH_RADIUS;
  const y =
    Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360)) * EARTH_RADIUS;
  return { x, y };
}

export function unprojectMercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

export function distanceOnMercator(a: MercatorPoint, b: MercatorPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

