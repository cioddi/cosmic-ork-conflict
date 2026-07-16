/**
 * DeckGL Icon Layer Component
 *
 * Reusable wrapper for DeckGL's IconLayer with react-maplibre integration.
 * Displays icons/sprites with rotation and interaction support.
 */

import { IconLayer } from "@deck.gl/layers";
import { BaseDeckGLLayer, useLayerCursor } from "./BaseDeckGLLayer";
import { useMemo, useCallback } from "react";

export interface IconDescriptor {
  id: string;
  url: string;
  width: number;
  height: number;
  anchorX?: number;
  anchorY?: number;
  mask?: boolean;
}

export interface DeckGLIconLayerProps<DataT = any> {
  /** Unique layer ID */
  id: string;

  /** Data to render */
  data: DataT[];

  /** Get position [lng, lat] from data item */
  getPosition: (d: DataT) => [number, number];

  /** Get icon descriptor from data item */
  getIcon: (d: DataT) => IconDescriptor;

  /** Get rotation angle in degrees (optional) */
  getAngle?: (d: DataT) => number;

  /** Get icon size in pixels (optional, default: 48) */
  getSize?: (d: DataT) => number;

  /** Whether layer is visible */
  visible?: boolean;

  /** Whether layer is pickable/clickable */
  pickable?: boolean;

  /** Click handler */
  onClick?: (info: any, event: any) => void;

  /** Hover handler */
  onHover?: (info: any, event: any) => void;

  /** Auto highlight on hover */
  autoHighlight?: boolean;

  /** Highlight color [r, g, b, a] */
  highlightColor?: [number, number, number, number];

  /** Size units (pixels, meters, etc.) */
  sizeUnits?: "pixels" | "meters" | "common";

  /** Min size in pixels */
  sizeMinPixels?: number;

  /** Max size in pixels */
  sizeMaxPixels?: number;

  /** Size scale multiplier */
  sizeScale?: number;

  /** Map ID to attach to */
  mapId?: string;

  /** Enable cursor change on hover */
  enableCursorChange?: boolean;

  /** Additional IconLayer props */
  layerProps?: any;
}

/**
 * Icon Layer Component
 */
export function DeckGLIconLayer<DataT = any>({
  id,
  data,
  getPosition,
  getIcon,
  getAngle,
  getSize,
  visible = true,
  pickable = true,
  onClick,
  onHover,
  autoHighlight = true,
  highlightColor = [255, 255, 255, 128],
  sizeUnits = "pixels",
  sizeMinPixels = 24,
  sizeMaxPixels = 96,
  sizeScale = 1,
  mapId = "map_1",
  enableCursorChange = true,
  layerProps = {},
}: DeckGLIconLayerProps<DataT>) {
  const { handleHover: cursorHandleHover } = useLayerCursor(mapId);

  // Combine hover handlers
  const combinedHoverHandler = useCallback(
    (info: any, event: any) => {
      if (enableCursorChange) {
        cursorHandleHover(info);
      }
      if (onHover) {
        onHover(info, event);
      }
    },
    [onHover, cursorHandleHover, enableCursorChange]
  );

  const deckLayerProps = useMemo(
    () => ({
      pickable,
      sizeUnits,
      sizeMinPixels,
      sizeMaxPixels,
      sizeScale,
      getPosition,
      getIcon,
      getAngle: getAngle || (() => 0),
      getSize: getSize || (() => 48),
      onClick,
      onHover: combinedHoverHandler,
      autoHighlight,
      highlightColor,
      parameters: { depthTest: false },
      loadOptions: {
        image: {
          crossOrigin: "anonymous",
          onError: (error: any) => {
            console.warn(`Icon loading error in layer ${id}:`, error);
          },
        },
      },
      ...layerProps,
    }),
    [
      pickable,
      sizeUnits,
      sizeMinPixels,
      sizeMaxPixels,
      sizeScale,
      getPosition,
      getIcon,
      getAngle,
      getSize,
      onClick,
      combinedHoverHandler,
      autoHighlight,
      highlightColor,
      layerProps,
      id,
    ]
  );

  return (
    <BaseDeckGLLayer
      id={id}
      layerType={IconLayer}
      data={data}
      visible={visible}
      mapId={mapId}
      layerProps={deckLayerProps}
    />
  );
}
