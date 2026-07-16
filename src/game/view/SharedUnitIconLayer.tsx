import { useEffect, useState } from "react";
import { MlLayer, useMap } from "@mapcomponents/react-maplibre";
import { StyleImageInterface } from "maplibre-gl";
import { MiniatureType } from "../classes/Miniature";

const ICONS = [
  { id: "unit-character", url: "assets/character.png" },
  { id: "unit-vehicle", url: "assets/vehicle.png" },
  { id: "unit-infantry", url: "assets/infantry.png" },
] as const;

type UnitIconImage =
  | HTMLImageElement
  | ImageBitmap
  | ImageData
  | StyleImageInterface;

export default function SharedUnitIconLayer(props: {
  sourceId: string;
  enabled: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const { sourceId, enabled, onReady } = props;
  const mapHook = useMap({ mapId: "map_1" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrapper = mapHook.map;
    if (!wrapper) return;
    let cancelled = false;
    let handleMapLoad: (() => void) | undefined;
    setReady(false);
    onReady?.(false);

    const mapReady = new Promise<void>((resolve) => {
      if (wrapper.map.loaded()) {
        resolve();
        return;
      }
      handleMapLoad = resolve;
      wrapper.map.once("load", handleMapLoad);
    });
    const loadedIcons = Promise.all(
      ICONS.map(
        ({ id, url }) =>
          new Promise<{ id: string; image: UnitIconImage }>((resolve, reject) => {
            wrapper.map.loadImage(url, (error, image) => {
              if (error || !image) {
                reject(error ?? new Error(`Unable to load ${url}`));
                return;
              }
              resolve({ id, image });
            });
          })
      )
    );
    Promise.all([mapReady, loadedIcons])
      .then(([, icons]) => {
        if (cancelled) return;
        for (const { id, image } of icons) {
          if (!wrapper.map.hasImage(id)) {
            wrapper.addImage(id, image, mapHook.componentId);
          }
        }
        setReady(true);
        onReady?.(true);
      })
      .catch((error) => console.error("Unable to load unit icons", error));
    return () => {
      cancelled = true;
      if (handleMapLoad) wrapper.map.off("load", handleMapLoad);
      onReady?.(false);
    };
  }, [mapHook.map, mapHook.componentId, onReady]);

  if (!ready || !enabled) return null;
  return (
    <MlLayer
      layerId="game-unit-icons"
      options={{
        type: "symbol",
        source: sourceId,
        layout: {
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-image": [
            "match",
            ["get", "type"],
            MiniatureType.CHARACTER,
            "unit-character",
            MiniatureType.VEHICLE,
            "unit-vehicle",
            "unit-infantry",
          ],
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
          "icon-opacity": ["case", [">", ["get", "hitpoints"], 0], 1, 0.2],
        },
      }}
    />
  );
}
