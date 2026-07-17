import { useEffect, useMemo } from "react";
import { GeoJSONSource } from "maplibre-gl";
import { GameSnapshot } from "../classes/Game";
import { LocalProjection } from "../world";
import {
  RenderedGameFeatureCollection,
  gameSnapshotToRenderedGeoJSON,
} from "./MapLibreSnapshotAdapter";
import { useMapLibreMap } from "./MapLibreView";

export function useAnimatedGameGeoJSON(
  snapshot: GameSnapshot | undefined,
  projection: LocalProjection | undefined,
  sourceId: string,
  durationMilliseconds = 500,
  maximumFramesPerSecond = 30
): RenderedGameFeatureCollection | undefined {
  const map = useMapLibreMap();
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const shouldAnimate = Boolean(
    snapshot && snapshot.movementTraces.length > 0 && !reducedMotion
  );
  const initialGeojson = useMemo(
    () =>
      snapshot && projection
        ? gameSnapshotToRenderedGeoJSON(
            snapshot,
            projection,
            shouldAnimate ? 0 : 1
          )
        : undefined,
    [snapshot, projection, shouldAnimate]
  );

  useEffect(() => {
    if (!snapshot || !projection || !shouldAnimate || !map) return;
    let frame: number | undefined;
    let startedAt: number | undefined;
    const minimumFrameInterval = 1000 / Math.max(1, maximumFramesPerSecond);
    let lastRenderedAt = 0;
    const update = (now: number) => {
      const source = map.getSource(sourceId) as
        | GeoJSONSource
        | undefined;
      if (!source) {
        frame = requestAnimationFrame(update);
        return;
      }
      if (startedAt === undefined) {
        startedAt = now;
        lastRenderedAt = now;
      }
      const progress = Math.min(1, (now - startedAt) / durationMilliseconds);
      if (progress >= 1 || now - lastRenderedAt >= minimumFrameInterval) {
        source.setData(
          gameSnapshotToRenderedGeoJSON(snapshot, projection, progress)
        );
        lastRenderedAt = now;
      }
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [
    snapshot,
    projection,
    sourceId,
    durationMilliseconds,
    maximumFramesPerSecond,
    shouldAnimate,
    map,
  ]);

  return initialGeojson;
}
