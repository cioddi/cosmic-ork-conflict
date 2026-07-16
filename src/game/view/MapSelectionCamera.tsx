import { useEffect, useRef } from "react";
import { useMap } from "@mapcomponents/react-maplibre";
import { LngLatLike } from "maplibre-gl";
import { useGame } from "../GameContext";

export default function MapSelectionCamera() {
  const state = useGame();
  const mapHook = useMap({ mapId: "map_1" });
  const previousId = useRef<string>();

  useEffect(() => {
    const selected = state?.selectedMiniature;
    const selectedId = state?.selectedMiniatureId;
    if (!selected || !selectedId || !mapHook.map || previousId.current === selectedId) return;
    previousId.current = selectedId;
    mapHook.map.map.easeTo({
      center: selected.geometry.coordinates as LngLatLike,
      zoom: 16,
    });
  }, [state?.selectedMiniature, state?.selectedMiniatureId, mapHook.map]);

  return null;
}

