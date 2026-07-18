import { Feature, FeatureCollection, Geometry } from "geojson";
import { GeoJSONSource } from "maplibre-gl";
import { useEffect } from "react";
import { useGame } from "../GameContext";
import { CombatTrace } from "../classes/Game";
import { LocalProjection, interpolate } from "../world";
import { useMapLibreMap } from "./MapLibreView";

const SOURCE_ID = "game-combat-effects";
const LAYER_IDS = [
  "game-ranged-tracers",
  "game-ranged-projectiles",
  "game-melee-slashes",
  "game-hit-bursts",
] as const;
const EMPTY_EFFECTS: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type EffectProperties = {
  id: string;
  effect: "ranged-tracer" | "projectile" | "melee-slash" | "hit";
  damage: number;
};

export function combatTracesToGeoJSON(
  traces: readonly CombatTrace[],
  projection: LocalProjection,
  progress: number
): FeatureCollection<Geometry, EffectProperties> {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    type: "FeatureCollection",
    features: traces.flatMap((trace) => combatTraceFeatures(trace, projection, clamped)),
  };
}

function combatTraceFeatures(
  trace: CombatTrace,
  projection: LocalProjection,
  progress: number
): Feature<Geometry, EffectProperties>[] {
  const start = [...projection.unproject(trace.start)];
  const end = [...projection.unproject(trace.end)];
  const effect = trace.kind === "ranged" ? "ranged-tracer" : "melee-slash";
  const features: Feature<Geometry, EffectProperties>[] = [
    {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [start, end] },
      properties: { id: trace.id, effect, damage: trace.damage },
    },
  ];

  if (trace.kind === "ranged") {
    const projectilePosition = [
      ...projection.unproject(
        interpolate(trace.start, trace.end, Math.min(1, progress * 1.45))
      ),
    ];
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: projectilePosition },
      properties: {
        id: `${trace.id}-projectile`,
        effect: "projectile",
        damage: trace.damage,
      },
    });
  }

  if (trace.hit && progress >= 0.62) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: end },
      properties: {
        id: `${trace.id}-hit`,
        effect: "hit",
        damage: trace.damage,
      },
    });
  }
  return features;
}

export default function CombatEffects() {
  const game = useGame();
  const map = useMapLibreMap();
  const projection = game?.game?.world.projection;
  const snapshot = game?.snapshot;

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_EFFECTS });
    }
    if (!map.getLayer("game-ranged-tracers")) {
      map.addLayer({
        id: "game-ranged-tracers",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "effect"], "ranged-tracer"],
        paint: {
          "line-color": "#ffe45c",
          "line-width": 2.5,
          "line-blur": 1,
          "line-opacity": 0.78,
        },
      });
    }
    if (!map.getLayer("game-ranged-projectiles")) {
      map.addLayer({
        id: "game-ranged-projectiles",
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "effect"], "projectile"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#fffbd1",
          "circle-stroke-color": "#ff9d2e",
          "circle-stroke-width": 3,
          "circle-blur": 0.25,
        },
      });
    }
    if (!map.getLayer("game-melee-slashes")) {
      map.addLayer({
        id: "game-melee-slashes",
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "effect"], "melee-slash"],
        paint: {
          "line-color": "#ff5c46",
          "line-width": 6,
          "line-blur": 1.5,
          "line-opacity": 0.9,
          "line-dasharray": [0.6, 0.4],
        },
      });
    }
    if (!map.getLayer("game-hit-bursts")) {
      map.addLayer({
        id: "game-hit-bursts",
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "effect"], "hit"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "damage"],
            0,
            8,
            12,
            22,
          ],
          "circle-color": "rgba(255, 67, 37, 0.16)",
          "circle-stroke-color": "#ffdf85",
          "circle-stroke-width": 4,
          "circle-blur": 0.2,
        },
      });
    }

    return () => {
      if (!map.getContainer().classList.contains("maplibregl-map")) return;
      for (const layerId of [...LAYER_IDS].reverse()) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !projection || !snapshot) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    if (snapshot.combatTraces.length === 0) {
      source.setData(EMPTY_EFFECTS);
      return;
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      source.setData(combatTracesToGeoJSON(snapshot.combatTraces, projection, 1));
      return;
    }

    let frame: number | undefined;
    let startedAt: number | undefined;
    const durationMilliseconds = 560;
    const animate = (now: number) => {
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / durationMilliseconds);
      source.setData(combatTracesToGeoJSON(snapshot.combatTraces, projection, progress));
      const fade = progress < 0.75 ? 1 : (1 - progress) / 0.25;
      for (const layerId of LAYER_IDS) {
        const property = layerId.includes("tracer") || layerId.includes("slash")
          ? "line-opacity"
          : "circle-opacity";
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, fade);
      }
      if (progress < 1) frame = requestAnimationFrame(animate);
      else source.setData(EMPTY_EFFECTS);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [map, projection, snapshot]);

  return null;
}
