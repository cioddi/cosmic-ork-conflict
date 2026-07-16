import { MlGeoJsonLayer, MlLayer, useMap } from "@mapcomponents/react-maplibre";
import { DataDrivenPropertyValueSpecification } from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import { MiniatureOptions, MiniatureType } from "./classes/Miniature";
import { useGame } from "./GameContext";
import { useAnimatedGameGeoJSON } from "./view/useAnimatedGameGeoJSON";
import SharedUnitIconLayer from "./view/SharedUnitIconLayer";

const GAME_UNITS_SOURCE_ID = "game-units";

export const getImageSrcFromProps = (
  props: Omit<MiniatureOptions, "position">
) => {
  if (props.image) return props.image;

  switch (props.type) {
    case MiniatureType.CHARACTER:
      return "assets/character.png";
    case MiniatureType.ROBOT:
      return "assets/infantry.png";
    case MiniatureType.VEHICLE:
      return "assets/vehicle.png";
    case MiniatureType.INFANTRY:
    default:
      return "assets/infantry.png";
  }
};

export default function GameDataLayers() {
  const game = useGame();
  const mapHook = useMap({ mapId: "map_1" });
  const [iconsReady, setIconsReady] = useState(false);
  const renderedGeojson = useAnimatedGameGeoJSON(
    game?.snapshot,
    game?.game?.world.projection,
    520
  );
  const viewCanRender = Boolean(iconsReady && renderedGeojson);
  const setViewReady = game?.setViewReady;
  const players = game?.game?.players;
  const selectedRenderedMiniature = useMemo(
    () =>
      game?.selectedMiniatureId
        ? renderedGeojson?.features.find(
            (feature) => feature.properties.id === game.selectedMiniatureId
          )
        : undefined,
    [renderedGeojson, game?.selectedMiniatureId]
  );

  useEffect(() => {
    if (!setViewReady) return;
    if (!viewCanRender) {
      setViewReady(false);
      return;
    }
    let firstFrame: number | undefined;
    let secondFrame: number | undefined;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setViewReady(true));
    });
    return () => {
      if (firstFrame !== undefined) cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      setViewReady(false);
    };
  }, [setViewReady, viewCanRender]);

  const textColorExpression = useMemo(() => {
    if (!players) return "black";

    let expression = [
      "case",
      ...players.flatMap((el, idx) => {
        return [["==", ["get", "playerId"], idx + 1], el.color];
      }),
      "green",
    ];
    return expression;
  }, [players]);

  const circleStrokeExpression = useMemo<
    DataDrivenPropertyValueSpecification<string> | undefined
  >(() => {
    if (!players) return "black";

    let expression = [
      "case",
      ...players.flatMap((el, idx) => {
        return [["==", ["get", "playerId"], idx + 1], el.color];
      }),
      "green",
    ] as DataDrivenPropertyValueSpecification<string>;

    return expression;
  }, [players]);

  return (
    <>
      {viewCanRender && selectedRenderedMiniature && (
        <MlGeoJsonLayer
          layerId="selected-miniature-indicator"
          geojson={selectedRenderedMiniature}
          paint={{
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10,
              // @ts-ignore
              ["*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, -6]],
              24,
              // @ts-ignore
              ["*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, 8]],
            ],
            "circle-opacity": 0,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 4,
            "circle-stroke-color": "#b4ddff",
          }}
        />
      )}
      {viewCanRender && renderedGeojson && (
        <MlGeoJsonLayer
          layerId={GAME_UNITS_SOURCE_ID}
          geojson={renderedGeojson}
          paint={{
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              0,
              0,
              24,
              // @ts-ignore
              ["*", ["*", 28, ["get", "x", ["get", "size"]]], ["^", 2, 8]],
            ],
            "circle-stroke-color": circleStrokeExpression,
            "circle-stroke-width": 2,
            "circle-color": "rgba(0,0,0,0)",
            "circle-opacity": [
              "case",
              [">", ["get", "hitpoints"], 0],
              0.4,
              0.2,
            ],
            "circle-stroke-opacity": [
              "case",
              [">", ["get", "hitpoints"], 0],
              0.8,
              0.2,
            ],
          }}
          key="circlelayer"
          onClick={(event: any) => {
            const id = event.features?.[0]?.properties?.id;
            if (id) game?.setSelectedMiniatureId(id);
          }}
          onHover={() => {
            const parent = mapHook.map?.map.getCanvas().parentElement;
            if (parent) parent.style.cursor = "pointer";
          }}
          onLeave={() => {
            const parent = mapHook.map?.map.getCanvas().parentElement;
            if (parent) parent.style.cursor = "";
          }}
        />
      )}
      <SharedUnitIconLayer
        sourceId={GAME_UNITS_SOURCE_ID}
        enabled={viewCanRender}
        onReady={setIconsReady}
      />
      {viewCanRender && renderedGeojson && (
        <MlLayer
          layerId="game-unit-labels"
          options={{
            type: "symbol",
            source: GAME_UNITS_SOURCE_ID,
            layout: {
              "text-field": [
                "concat",
                ["get", "name"],
                " (",
                ["get", "hitpoints"],
                " hitpoints)",
              ],
              "text-font": ["Metropolis Regular"],
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-optional": true,
              "text-padding": 4,
              "symbol-sort-key": [
                "-",
                0,
                ["coalesce", ["get", "killCount"], 0],
              ],
              "text-variable-anchor": [
                "left",
                "right",
                "top",
                "bottom",
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
                "center",
              ],
              "text-size": 10,
              //"symbol-placement": "point",
              "text-offset": [2, 2],
            },
            paint: {
              "text-color": textColorExpression,
              "text-opacity": ["case", [">", ["get", "hitpoints"], 0], 1, 0],
              "text-halo-color": [
                "case",
                [">", ["get", "hitpoints"], 0],
                "black",
                "#ffafa9",
              ],
              "text-halo-width": 2,
            },
          }}
          key={"labels"}
        />
      )}
    </>
  );
}
