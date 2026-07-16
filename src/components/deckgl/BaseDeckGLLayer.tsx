/**
 * Base DeckGL Layer Component
 *
 * This provides common functionality for all DeckGL layer components:
 * - Layer lifecycle management (initialization, updates, cleanup)
 * - Integration with react-maplibre
 * - Proper cleanup and memory management
 * - Throttled map repainting for performance
 */

import { useMap } from "@mapcomponents/react-maplibre";
import { useEffect, useRef, useCallback } from "react";
import { MapboxLayer } from "@deck.gl/mapbox";

export interface BaseDeckGLLayerProps<DataT = any> {
  /** Unique ID for this layer */
  id: string;

  /** The DeckGL layer type (e.g., IconLayer, ScatterplotLayer) */
  layerType: any;

  /** Data to render */
  data: DataT[];

  /** Whether the layer is visible */
  visible?: boolean;

  /** Map ID to attach to (default: "map_1") */
  mapId?: string;

  /** Layer props to pass to DeckGL layer */
  layerProps: any;

  /** Callback when layer is initialized */
  onLayerInit?: (layer: MapboxLayer<any>) => void;

  /** Callback when layer is destroyed */
  onLayerDestroy?: () => void;
}

/**
 * Base component for DeckGL layers
 * Handles the common lifecycle and integration with Maplibre
 */
export function BaseDeckGLLayer<DataT = any>({
  id,
  layerType,
  data,
  visible = true,
  mapId = "map_1",
  layerProps,
  onLayerInit,
  onLayerDestroy,
}: BaseDeckGLLayerProps<DataT>) {
  const mapHook = useMap({ mapId });
  const layerRef = useRef<MapboxLayer<any> | null>(null);
  const updateTimeoutRef = useRef<number>();

  // Initialize layer when map is ready
  useEffect(() => {
    if (!mapHook.map) {
      return;
    }

    const mapInstance = mapHook.map.map;

    const addLayer = () => {
      try {
        if (!layerRef.current) {
          const deckLayer = new MapboxLayer({
            id,
            type: layerType,
            data: [],
            visible: false,
            ...layerProps,
          });

          layerRef.current = deckLayer;
          mapInstance.addLayer(deckLayer as any);

          if (onLayerInit) {
            onLayerInit(deckLayer);
          }
        }
      } catch (error) {
        console.error(`Error creating DeckGL layer ${id}:`, error);
      }
    };

    if (mapInstance.isStyleLoaded()) {
      addLayer();
    } else {
      const handleStyle = () => {
        addLayer();
      };
      mapInstance.once("styledata", handleStyle);
      return () => {
        mapInstance.off("styledata", handleStyle);
      };
    }

    // Cleanup function
    return () => {
      try {
        if (layerRef.current) {
          try {
            if (mapInstance.getLayer(id)) {
              mapInstance.removeLayer(id);
            }
          } catch (error) {
            console.warn(`Error removing layer ${id}:`, error);
          }

          if (layerRef.current.finalize) {
            try {
              layerRef.current.finalize();
            } catch (error) {
              console.warn(`Error finalizing layer ${id}:`, error);
            }
          }

          layerRef.current = null;

          if (onLayerDestroy) {
            onLayerDestroy();
          }
        }
      } catch (error) {
        console.error(`Error during layer ${id} cleanup:`, error);
      }
    };
  }, [mapHook.map, id, layerType, onLayerInit, onLayerDestroy]);

  // Update layer when props change
  useEffect(() => {
    if (!layerRef.current) {
      return;
    }

    try {
      layerRef.current.setProps({
        data,
        visible: visible && data.length > 0,
        ...layerProps,
      });

      // Throttled map repaint for performance
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = window.setTimeout(() => {
        mapHook.map?.map.triggerRepaint();
      }, 16); // ~60fps throttling
    } catch (error) {
      console.error(`Error updating DeckGL layer ${id}:`, error);
    }
  }, [data, visible, layerProps, mapHook.map, id]);

  // Cleanup update timeout
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return null; // DeckGL layers are rendered directly to the map
}

/**
 * Hook for managing cursor changes on hover
 */
export function useLayerCursor(mapId: string = "map_1") {
  const mapHook = useMap({ mapId });

  const handleHover = useCallback(
    (info: any) => {
      if (!mapHook.map) {
        return;
      }
      const canvasParent = mapHook.map.map.getCanvas().parentElement;
      if (!canvasParent) {
        return;
      }
      canvasParent.style.cursor = info?.object ? "pointer" : "";
    },
    [mapHook.map]
  );

  const resetCursor = useCallback(() => {
    if (!mapHook.map) {
      return;
    }
    const canvasParent = mapHook.map.map.getCanvas().parentElement;
    if (canvasParent) {
      canvasParent.style.cursor = "";
    }
  }, [mapHook.map]);

  return { handleHover, resetCursor };
}
