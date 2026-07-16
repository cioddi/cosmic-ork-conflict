import { useEffect, useState } from "react";
import { GameSnapshot } from "../classes/Game";
import { LocalProjection } from "../world";
import {
  GameStateFeatureCollectionType,
  gameSnapshotToGeoJSON,
} from "./MapLibreSnapshotAdapter";

export function useAnimatedGameGeoJSON(
  snapshot: GameSnapshot | undefined,
  projection: LocalProjection | undefined,
  durationMilliseconds = 500,
  maximumFramesPerSecond = 30
): GameStateFeatureCollectionType | undefined {
  const [geojson, setGeojson] = useState<GameStateFeatureCollectionType>();

  useEffect(() => {
    if (!snapshot || !projection) {
      setGeojson(undefined);
      return;
    }
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || snapshot.movementTraces.length === 0) {
      setGeojson(gameSnapshotToGeoJSON(snapshot, projection));
      return;
    }
    let frame: number | undefined;
    const startedAt = performance.now();
    const minimumFrameInterval = 1000 / Math.max(1, maximumFramesPerSecond);
    let lastRenderedAt = startedAt;
    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMilliseconds);
      if (progress >= 1 || now - lastRenderedAt >= minimumFrameInterval) {
        setGeojson(gameSnapshotToGeoJSON(snapshot, projection, progress));
        lastRenderedAt = now;
      }
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    setGeojson(gameSnapshotToGeoJSON(snapshot, projection, 0));
    frame = requestAnimationFrame(update);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [snapshot, projection, durationMilliseconds, maximumFramesPerSecond]);

  return geojson;
}
