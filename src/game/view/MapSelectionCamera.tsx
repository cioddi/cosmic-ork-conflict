import { useEffect, useRef } from "react";
import { LngLatLike } from "maplibre-gl";
import { useGame } from "../GameContext";
import { useMapLibreMap } from "./MapLibreView";

export default function MapSelectionCamera() {
  const state = useGame();
  const map = useMapLibreMap();
  const previousId = useRef<string>();

  useEffect(() => {
    const selected = state?.selectedMiniature;
    const selectedId = state?.selectedMiniatureId;
    if (!selected || !selectedId || !map || previousId.current === selectedId) return;
    previousId.current = selectedId;
    map.easeTo({
      center: selected.geometry.coordinates as LngLatLike,
      zoom: 16,
    });
  }, [state?.selectedMiniature, state?.selectedMiniatureId, map]);

  return null;
}
