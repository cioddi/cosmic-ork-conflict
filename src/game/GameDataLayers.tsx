import {
  DataDrivenPropertyValueSpecification,
  FilterSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGame } from "./GameContext";
import { useAnimatedGameGeoJSON } from "./view/useAnimatedGameGeoJSON";
import SharedUnitIconLayer from "./view/SharedUnitIconLayer";
import CombatEffects from "./view/CombatEffects";
import { useMapLibreMap } from "./view/MapLibreView";

const GAME_UNITS_SOURCE_ID = "game-units";
const GAME_LAYER_IDS = [
  "game-unit-circles",
  "game-unit-icons",
  "selected-miniature-indicator",
  "game-unit-labels",
] as const;
const UNIT_CIRCLE_RADIUS = [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  0,
  0,
  24,
  ["*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, 8]],
] as unknown as DataDrivenPropertyValueSpecification<number>;
const SELECTED_CIRCLE_RADIUS = [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  10,
  ["*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, -6]],
  24,
  ["*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, 8]],
] as unknown as DataDrivenPropertyValueSpecification<number>;
const UNIT_ICON_SIZE = [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  10,
  ["^", 2, -6],
  24,
  ["^", 2, 8],
] as unknown as DataDrivenPropertyValueSpecification<number>;

export default function GameDataLayers() {
  const game = useGame();
  const map = useMapLibreMap();
  const [iconsReady, setIconsReady] = useState(false);
  const [layersReady, setLayersReady] = useState(false);
  const renderedGeojson = useAnimatedGameGeoJSON(
    game?.snapshot,
    game?.game?.world.projection,
    GAME_UNITS_SOURCE_ID,
    520
  );
  const viewCanRender = Boolean(layersReady && renderedGeojson);
  const setViewReady = game?.setViewReady;
  const setSelectedMiniatureId = game?.setSelectedMiniatureId;
  const players = game?.game?.players;
  const selectedMiniatureFilter = useMemo<FilterSpecification>(
    () => ["==", ["get", "id"], game?.selectedMiniatureId ?? ""],
    [game?.selectedMiniatureId]
  );
  const handleIconsReady = useCallback((ready: boolean) => setIconsReady(ready), []);

  const playerColorExpression = useMemo<
    DataDrivenPropertyValueSpecification<string>
  >(() => {
    if (!players) return "black";
    return [
      "case",
      ...players.flatMap((player, index) => [
        ["==", ["get", "playerId"], index + 1],
        player.color,
      ]),
      "green",
    ] as DataDrivenPropertyValueSpecification<string>;
  }, [players]);

  useEffect(() => {
    if (!map || !iconsReady) return;
    let installed = false;

    const installLayers = () => {
      if (!map.getSource(GAME_UNITS_SOURCE_ID)) {
        map.addSource(GAME_UNITS_SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("game-unit-circles")) {
        map.addLayer({
          id: "game-unit-circles",
          type: "circle",
          source: GAME_UNITS_SOURCE_ID,
          paint: {
            "circle-radius": UNIT_CIRCLE_RADIUS,
            "circle-stroke-color": playerColorExpression,
            "circle-stroke-width": 2,
            "circle-color": "rgba(0,0,0,0)",
            "circle-opacity": ["case", [">", ["get", "hitpoints"], 0], 0.4, 0.2],
            "circle-stroke-opacity": ["case", [">", ["get", "hitpoints"], 0], 0.8, 0.2],
          },
        });
      }
      if (!map.getLayer("game-unit-icons")) {
        map.addLayer({
          id: "game-unit-icons",
          type: "symbol",
          source: GAME_UNITS_SOURCE_ID,
          layout: {
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-image": ["get", "iconId"],
            "icon-size": UNIT_ICON_SIZE,
          },
          paint: {
            "icon-opacity": ["case", [">", ["get", "hitpoints"], 0], 1, 0.2],
          },
        });
      }
      if (!map.getLayer("selected-miniature-indicator")) {
        map.addLayer({
          id: "selected-miniature-indicator",
          type: "circle",
          source: GAME_UNITS_SOURCE_ID,
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-radius": SELECTED_CIRCLE_RADIUS,
            "circle-opacity": 0,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 4,
            "circle-stroke-color": "#b4ddff",
          },
        });
      }
      if (!map.getLayer("game-unit-labels")) {
        map.addLayer({
          id: "game-unit-labels",
          type: "symbol",
          source: GAME_UNITS_SOURCE_ID,
          layout: {
            "text-field": ["concat", ["get", "name"], " (", ["get", "hitpoints"], " hitpoints)"],
            "text-font": ["Metropolis Regular"],
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-optional": true,
            "text-padding": 4,
            "symbol-sort-key": ["-", 0, ["coalesce", ["get", "killCount"], 0]],
            "text-variable-anchor": [
              "left", "right", "top", "bottom", "top-left", "top-right",
              "bottom-left", "bottom-right", "center",
            ],
            "text-size": 10,
            "text-offset": [2, 2],
          },
          paint: {
            "text-color": playerColorExpression,
            "text-opacity": ["case", [">", ["get", "hitpoints"], 0], 1, 0],
            "text-halo-color": ["case", [">", ["get", "hitpoints"], 0], "black", "#ffafa9"],
            "text-halo-width": 2,
          },
        });
      }

      const handleClick = (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelectedMiniatureId?.(id);
      };
      const showPointer = () => { map.getCanvas().style.cursor = "pointer"; };
      const hidePointer = () => { map.getCanvas().style.cursor = ""; };
      map.on("click", "game-unit-circles", handleClick);
      map.on("mouseenter", "game-unit-circles", showPointer);
      map.on("mouseleave", "game-unit-circles", hidePointer);
      installed = true;
      setLayersReady(true);

      return () => {
        map.off("click", "game-unit-circles", handleClick);
        map.off("mouseenter", "game-unit-circles", showPointer);
        map.off("mouseleave", "game-unit-circles", hidePointer);
      };
    };

    const removeListeners = installLayers();

    return () => {
      // React may clean up MapLibreView's parent effect before this child
      // effect. Map#remove clears the style, so no layer API is safe after the
      // container loses MapLibre's marker class (and no cleanup is needed).
      if (!map.getContainer().classList.contains("maplibregl-map")) {
        setLayersReady(false);
        return;
      }
      removeListeners?.();
      if (installed) {
        for (const layerId of [...GAME_LAYER_IDS].reverse()) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
        if (map.getSource(GAME_UNITS_SOURCE_ID)) map.removeSource(GAME_UNITS_SOURCE_ID);
      }
      setLayersReady(false);
    };
  }, [map, iconsReady, playerColorExpression, setSelectedMiniatureId]);

  useEffect(() => {
    if (!map?.getLayer("selected-miniature-indicator")) return;
    map.setFilter("selected-miniature-indicator", selectedMiniatureFilter);
  }, [map, selectedMiniatureFilter]);

  useEffect(() => {
    if (!map || !layersReady || !renderedGeojson) return;
    (map.getSource(GAME_UNITS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(renderedGeojson);
  }, [map, layersReady, renderedGeojson]);

  useEffect(() => {
    if (!setViewReady) return;
    if (!viewCanRender) {
      setViewReady(false);
      return;
    }
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setViewReady(true));
    });
    let secondFrame: number | undefined;
    return () => {
      if (firstFrame !== undefined) cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      setViewReady(false);
    };
  }, [setViewReady, viewCanRender]);

  return (
    <>
      <SharedUnitIconLayer
        enabled={Boolean(renderedGeojson)}
        onReady={handleIconsReady}
      />
      <CombatEffects />
    </>
  );
}
