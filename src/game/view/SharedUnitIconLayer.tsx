import { useEffect } from "react";
import { StyleImageInterface } from "maplibre-gl";
import { useMapLibreMap } from "./MapLibreView";
import { UNIT_ICONS } from "./UnitIconRegistry";

type UnitIconImage =
  | HTMLImageElement
  | ImageBitmap
  | ImageData
  | StyleImageInterface;

/** Loads shared catalogue images once; the parent owns the actual symbol layer. */
export default function SharedUnitIconLayer(props: {
  enabled: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const { enabled, onReady } = props;
  const map = useMapLibreMap();

  useEffect(() => {
    if (!map || !enabled) {
      onReady?.(false);
      return;
    }
    let cancelled = false;

    const loadIcons = () => {
      Promise.all(
        UNIT_ICONS.map(
          ({ id, url }) =>
            new Promise<{ id: string; image?: UnitIconImage }>((resolve, reject) => {
              if (map.hasImage(id)) return resolve({ id });
              map.loadImage(url, (error, image) => {
                if (error || !image) {
                  reject(error ?? new Error(`Unable to load ${url}`));
                  return;
                }
                resolve({ id, image });
              });
            }).catch((error: unknown) => ({ id, error }))
        )
      )
        .then((icons) => {
          if (cancelled) return;
          for (const icon of icons) {
            if ("error" in icon) {
              console.warn(`Unable to load unit icon ${icon.id}`, icon.error);
            } else if (icon.image && !map.hasImage(icon.id)) {
              map.addImage(icon.id, icon.image);
            }
          }
          onReady?.(true);
        });
    };

    loadIcons();

    return () => {
      cancelled = true;
      onReady?.(false);
    };
  }, [map, enabled, onReady]);

  return null;
}
