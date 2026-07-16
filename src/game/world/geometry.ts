import {
  GeographicPoint,
  GeographicPolygon,
  WorldBounds,
  WorldPoint,
  WorldPolygon,
  WorldRing,
} from "./types";
import { LocalProjection } from "./LocalProjection";

const EPSILON = 1e-9;

export function worldBoundsForPoints(points: readonly WorldPoint[]): WorldBounds {
  if (points.length === 0) {
    throw new Error("Cannot calculate bounds for an empty point collection");
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

export function expandBounds(bounds: WorldBounds, amount: number): WorldBounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  };
}

export function boundsIntersect(a: WorldBounds, b: WorldBounds): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}

export function pointInBounds(point: WorldPoint, bounds: WorldBounds): boolean {
  return (
    point[0] >= bounds.minX &&
    point[0] <= bounds.maxX &&
    point[1] >= bounds.minY &&
    point[1] <= bounds.maxY
  );
}

export function pointInRing(point: WorldPoint, ring: WorldRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (pointOnSegment(point, a, b)) return true;
    const crosses =
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] <
        ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: WorldPoint, polygon: WorldPolygon): boolean {
  if (!pointInBounds(point, polygon.bounds) || !pointInRing(point, polygon.outer)) {
    return false;
  }
  return !polygon.holes.some((hole) => pointInRing(point, hole));
}

export function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function interpolate(
  from: WorldPoint,
  to: WorldPoint,
  ratio: number
): WorldPoint {
  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
  ];
}

export function distancePointToSegment(
  point: WorldPoint,
  start: WorldPoint,
  end: WorldPoint
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return distance(point, start);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        lengthSquared
    )
  );
  return distance(point, [start[0] + t * dx, start[1] + t * dy]);
}

export function segmentsIntersect(
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
  d: WorldPoint
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnSegment(a, c, d)) return true;
  return o4 === 0 && pointOnSegment(b, c, d);
}

export function distanceSegmentToSegment(
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
  d: WorldPoint
): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distancePointToSegment(a, c, d),
    distancePointToSegment(b, c, d),
    distancePointToSegment(c, a, b),
    distancePointToSegment(d, a, b)
  );
}

export function distancePointToPolygon(
  point: WorldPoint,
  polygon: WorldPolygon
): number {
  if (pointInPolygon(point, polygon)) return 0;
  let nearest = distancePointToRing(point, polygon.outer);
  for (const hole of polygon.holes) {
    nearest = Math.min(nearest, distancePointToRing(point, hole));
  }
  return nearest;
}

export function segmentIntersectsPolygon(
  start: WorldPoint,
  end: WorldPoint,
  polygon: WorldPolygon,
  clearance: number
): boolean {
  if (pointInPolygon(start, polygon) || pointInPolygon(end, polygon)) return true;
  for (const ring of [polygon.outer, ...polygon.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (distanceSegmentToSegment(start, end, a, b) <= clearance + EPSILON) {
        return true;
      }
    }
  }
  const midpoint: WorldPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  return pointInPolygon(midpoint, polygon);
}

export function projectGeographicPolygon(
  polygon: GeographicPolygon,
  projection: LocalProjection,
  id: string
): WorldPolygon {
  const outer = normalizeRing(polygon.outer.map((point) => projection.project(point)));
  const holes = (polygon.holes ?? []).map((ring) =>
    normalizeRing(ring.map((point) => projection.project(point)))
  );
  return { id, outer, holes, bounds: worldBoundsForPoints(outer) };
}

export function geographicBounds(
  polygons: readonly GeographicPolygon[]
): [number, number, number, number] {
  const points: GeographicPoint[] = [];
  for (const polygon of polygons) points.push(...polygon.outer);
  if (points.length === 0) throw new Error("World definition has no coordinates");
  return [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1])),
  ];
}

export function normalizeRing(points: readonly WorldPoint[]): WorldRing {
  if (points.length < 3) throw new Error("A polygon ring requires at least three points");
  const normalized = [...points];
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) normalized.pop();
  if (normalized.length < 3) throw new Error("A polygon ring requires three distinct points");
  return normalized;
}

function distancePointToRing(point: WorldPoint, ring: WorldRing): number {
  let nearest = Infinity;
  forEachEdge(ring, (start, end) => {
    nearest = Math.min(nearest, distancePointToSegment(point, start, end));
  });
  return nearest;
}

function forEachEdge(
  ring: WorldRing,
  callback: (start: WorldPoint, end: WorldPoint) => void
): void {
  for (let i = 0; i < ring.length; i++) {
    callback(ring[i], ring[(i + 1) % ring.length]);
  }
}

function pointOnSegment(
  point: WorldPoint,
  start: WorldPoint,
  end: WorldPoint
): boolean {
  return (
    Math.abs(cross(start, end, point)) <= EPSILON &&
    point[0] >= Math.min(start[0], end[0]) - EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + EPSILON
  );
}

function orientation(a: WorldPoint, b: WorldPoint, c: WorldPoint): number {
  const value = cross(a, b, c);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function cross(a: WorldPoint, b: WorldPoint, c: WorldPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
