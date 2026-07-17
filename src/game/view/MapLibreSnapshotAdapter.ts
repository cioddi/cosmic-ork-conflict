import { GameSnapshot, MovementTrace } from "../classes/Game";
import { MiniatureOptions } from "../classes/Miniature";
import { LocalProjection, WorldPoint, interpolate } from "../world";
import { getUnitIconId } from "./UnitIconRegistry";

export interface MiniatureGeoJsonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Omit<MiniatureOptions, "position"> & { playerId: number };
}

export interface GameStateFeatureCollectionType {
  type: "FeatureCollection";
  features: MiniatureGeoJsonFeature[];
}

export type RenderedMiniatureProperties = Pick<
  MiniatureOptions,
  "id" | "name" | "type" | "size" | "hitpoints" | "killCount" | "bearing"
> & { playerId: number; iconId: string };

export interface RenderedMiniatureGeoJsonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: RenderedMiniatureProperties;
}

export interface RenderedGameFeatureCollection {
  type: "FeatureCollection";
  features: RenderedMiniatureGeoJsonFeature[];
}

export interface TraceSample {
  position: WorldPoint;
  bearing: number;
}

export function sampleMovementTrace(
  trace: MovementTrace,
  progress: number
): TraceSample {
  if (trace.points.length === 0) {
    throw new Error("Cannot sample an empty movement trace");
  }
  if (trace.points.length === 1 || trace.totalDistance <= 0) {
    return { position: [...trace.points[0]], bearing: 0 };
  }
  const targetDistance = Math.max(0, Math.min(1, progress)) * trace.totalDistance;
  let consumed = 0;
  for (let index = 0; index < trace.segmentLengths.length; index++) {
    const segmentLength = trace.segmentLengths[index];
    const from = trace.points[index];
    const to = trace.points[index + 1];
    if (targetDistance <= consumed + segmentLength || index === trace.segmentLengths.length - 1) {
      const ratio = segmentLength <= 0 ? 1 : (targetDistance - consumed) / segmentLength;
      return {
        position: interpolate(from, to, Math.max(0, Math.min(1, ratio))),
        bearing: bearing(from, to),
      };
    }
    consumed += segmentLength;
  }
  const last = trace.points[trace.points.length - 1];
  const previous = trace.points[trace.points.length - 2];
  return { position: [...last], bearing: bearing(previous, last) };
}

export function gameSnapshotToGeoJSON(
  snapshot: GameSnapshot,
  projection: LocalProjection,
  animationProgress = 1
): GameStateFeatureCollectionType {
  const traces = new Map(snapshot.movementTraces.map((trace) => [trace.unitId, trace]));
  return {
    type: "FeatureCollection",
    features: snapshot.units.map((unit) => {
      const trace = unit.properties.id ? traces.get(unit.properties.id) : undefined;
      const sample = trace ? sampleMovementTrace(trace, animationProgress) : null;
      const position = sample?.position ?? unit.position;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [...projection.unproject(position)],
        },
        properties: {
          ...unit.properties,
          bearing: sample?.bearing ?? unit.properties.bearing,
          playerId: unit.playerId,
        },
      };
    }),
  };
}

/** Minimal frame payload consumed by the MapLibre unit layers. */
export function gameSnapshotToRenderedGeoJSON(
  snapshot: GameSnapshot,
  projection: LocalProjection,
  animationProgress = 1
): RenderedGameFeatureCollection {
  const traces = new Map(snapshot.movementTraces.map((trace) => [trace.unitId, trace]));
  return {
    type: "FeatureCollection",
    features: snapshot.units.map((unit) => {
      const trace = unit.properties.id ? traces.get(unit.properties.id) : undefined;
      const sample = trace ? sampleMovementTrace(trace, animationProgress) : null;
      const position = sample?.position ?? unit.position;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [...projection.unproject(position)],
        },
        properties: {
          id: unit.properties.id,
          name: unit.properties.name,
          type: unit.properties.type,
          iconId: getUnitIconId(unit.properties.image, unit.properties.type),
          size: unit.properties.size,
          hitpoints: unit.properties.hitpoints,
          killCount: unit.properties.killCount,
          bearing: sample?.bearing ?? unit.properties.bearing,
          playerId: unit.playerId,
        },
      };
    }),
  };
}

function bearing(from: WorldPoint, to: WorldPoint): number {
  return (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
}
