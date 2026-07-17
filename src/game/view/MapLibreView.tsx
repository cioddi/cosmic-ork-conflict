import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import maplibregl, { Map, MapOptions } from "maplibre-gl";

const MapLibreContext = createContext<Map | null>(null);

type MapLibreViewProps = PropsWithChildren<{
  options: Omit<MapOptions, "container">;
}>;

/** A deliberately small bridge between React and the MapLibre view. */
export function MapLibreView({ children, options }: MapLibreViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const nextMap = new maplibregl.Map({
      ...optionsRef.current,
      container: containerRef.current,
    });
    const publishLoadedMap = () => {
      if (!cancelled) setMap(nextMap);
    };
    nextMap.once("style.load", publishLoadedMap);
    return () => {
      cancelled = true;
      nextMap.off("style.load", publishLoadedMap);
      setMap(null);
      nextMap.remove();
    };
  }, []);

  return (
    <MapLibreContext.Provider value={map}>
      <div className="mapContainer" ref={containerRef} />
      {children}
    </MapLibreContext.Provider>
  );
}

export function useMapLibreMap(): Map | null {
  return useContext(MapLibreContext);
}
