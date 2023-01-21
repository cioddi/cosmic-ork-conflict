import { MlGeoJsonLayer, MlLayer, useMap } from "@mapcomponents/react-maplibre";
import { amber } from "@mui/material/colors";
import {
  DataDrivenPropertyValueSpecification,
  MapLayerMouseEvent,
} from "maplibre-gl";
import { useMemo } from "react";
import MlImageMarkerLayer from "../components/MlImageMarkerLayer";
import { MiniatureOptions, MiniatureType } from "./classes/Miniature";
import { useGame } from "./GameContext";

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

  const textColorExpression = useMemo(() => {
    if (!game?.game?.players) return "black";

    let expression = [
      "case",
      ...game.game?.players.flatMap((el, idx) => {
        return [["==", ["get", "playerId"], idx + 1], el.color];
      }),
      "green",
    ];
    return expression;
  }, [game?.game?.players.length]);

  const circleStrokeExpression = useMemo<
    DataDrivenPropertyValueSpecification<string> | undefined
  >(() => {
    if (!game?.game?.players) return "black";

    let expression = [
      "case",
      ...game.game?.players.flatMap((el, idx) => {
        return [["==", ["get", "playerId"], idx + 1], el.color];
      }),
      "green",
    ] as DataDrivenPropertyValueSpecification<string>;

    return expression;
  }, [game?.game?.players.length]);

  return (
    <>
      {game?.geojson?.features?.map((el: any, idx: number) => {
        const _el = el;
        return (
            <MlImageMarkerLayer
              layerId={'layer' + _el.properties.type + idx}
              imageId={'image' + _el.properties.type + idx}
              options={{
                type: "symbol",
                source: {
                  type: "geojson",
                  data: el,
                },
                layout: {
                  "icon-allow-overlap": true,
                  "icon-size": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    10,
                    ["^", 2, -6],
                    24,
                    ["^", 2, 8],
                  ],
                },
                paint: {
                  "icon-opacity": [
                    "case",
                    [">", ["get", "hitpoints"], 0],
                    1,
                    0.2,
                  ],
                  "icon-halo-color": "red",
                  "icon-halo-width": 4,
                },
              }}
              imgSrc={getImageSrcFromProps(_el.properties)}
              key={"iconlayer_" + idx}
          onClick={
            ((ev) => {
              console.log(_el.properties);
              
              game.setSelectedMiniatureId(_el.properties.id);
            })
          }
          onHover={
            (() => {
              if (!mapHook.map) return;

              let canvasParent = mapHook.map.map.getCanvas().parentElement;
              if (canvasParent) {
                canvasParent.style.cursor = "pointer";
              }
            })
          }
          onLeave={
            (() => {
              if (!mapHook.map) return;
              
              let canvasParent = mapHook.map.map.getCanvas().parentElement;
              if (canvasParent) {
                canvasParent.style.cursor = "";
              }
            })
          }
            />
        );
      })}
      {game?.geojson && (
        <MlGeoJsonLayer
          geojson={game.geojson}
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
        />
      )}
      {game?.geojson && (
        <MlLayer
          options={{
            type: "symbol",
            layout: {
              "text-field": [
                "concat",
                ["get", "name"],
                " (",
                ["get", "hitpoints"],
                " hitpoints)",
              ],
              "text-font": ["Metropolis Regular"],
              "text-ignore-placement": false,
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
          geojson={game.geojson}
          key={"labels"}
        />
      )}
    </>
  );
}
