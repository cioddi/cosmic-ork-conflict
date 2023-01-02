import { MlGeoJsonLayer, MlLayer, useMap } from "@mapcomponents/react-maplibre";
import { MapLayerMouseEvent } from "maplibre-gl";
import MlImageMarkerLayer from "../components/MlImageMarkerLayer";
import { MiniatureOptions, MiniatureType } from "./classes/Miniature";
import { useGame } from "./GameContext";

export const getImageSrcFromProps = (props: Omit<MiniatureOptions,"position">) => {
  switch (props.type) {
    case MiniatureType.CHARACTER:
      return "/assets/character.png";
    case MiniatureType.ROBOT:
      return "/assets/infantry.png";
    case MiniatureType.VEHICLE:
      return "/assets/vehicle.png";
    case MiniatureType.INFANTRY:
    default:
      return "/assets/infantry.png";
  }
};

export default function GameDataLayers() {
  const game = useGame();
  const mapHook = useMap({ mapId: "map_1" });

  return (
    <>
      {game?.geojson?.features?.map((el: any, idx: number) => {
        return (
          <>
            <MlImageMarkerLayer
              layerId={el.type + idx}
              options={{
                type: "symbol",
                source: {
                  type: "geojson",
                  data: el,
                },
                layout: {
                  "icon-allow-overlap": true,
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
              imgSrc={getImageSrcFromProps(el.properties)}
              key={"iconlayer_" + idx}
            />
          </>
        );
      })}
      {game?.geojson && (
        <MlGeoJsonLayer
          geojson={game.geojson}
          paint={{
            "circle-radius": 24,
            "circle-stroke-color": [
              "case",
              ["==", ["get", "playerId"], 1],
              "green",
              "purple",
            ],
            "circle-stroke-width": 2,
            "circle-color": 'rgba(0,0,0,0)',
            "circle-opacity": ["case", [">", ["get", "hitpoints"], 0], 0.4, 0.2],
            "circle-stroke-opacity": [
              "case",
              [">", ["get", "hitpoints"], 0],
              0.8,
              0.2,
            ],
          }}
          key="pointlayer"
          onClick={((ev: MapLayerMouseEvent) => {
            console.log(ev.features);
            game.setSelectedMiniatureId(ev.features?.[0]?.properties?.id);
          }) as unknown as MapLayerMouseEvent}
          onHover={
            (() => {
              if(!mapHook.map)return;
              mapHook.map.map.getCanvas().style.cursor = "pointer";
            }) as unknown as MapLayerMouseEvent
          }
          onLeave={
            (() => {
              if(!mapHook.map)return;
              mapHook.map.map.getCanvas().style.cursor = "";
            }) as unknown as MapLayerMouseEvent
          }
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
              //"text-ignore-placement": false,
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
              "text-color": [
                "case",
                ["==", ["get", "playerId"], 1],
                "blue",
                "green",
              ],
              "text-opacity": [
                "case",
                [">", ["get", "hitpoints"], 0],
                1,
                0,
              ],
              "text-halo-color": [
                "case",
                [">", ["get", "hitpoints"], 0],
                "white",
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
