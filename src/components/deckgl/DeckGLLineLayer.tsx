/**
 * DeckGL Line Layer Component
 *
 * Reusable wrapper for DeckGL's LineLayer with react-maplibre integration.
 * Displays lines between source and target positions with customizable styling.
 */

import { BaseDeckGLLayer, useLayerCursor } from "./BaseDeckGLLayer";
import { useMemo, useCallback } from "react";

// @ts-ignore - LineLayer exists but has TypeScript export issues
const { LineLayer } = require("@deck.gl/layers");

export interface DeckGLLineLayerProps<DataT = any> {
  /** Unique layer ID */
  id: string;

  /** Data to render */
  data: DataT[];

  /** Get source position [lng, lat] from data item */
  getSourcePosition: (d: DataT) => [number, number];

  /** Get target position [lng, lat] from data item */
  getTargetPosition: (d: DataT) => [number, number];

  /** Get line color [r, g, b, a] */
  getColor?: (d: DataT) => [number, number, number, number];

  /** Get line width in pixels */
  getWidth?: (d: DataT) => number;

  /** Whether layer is visible */
  visible?: boolean;

  /** Whether layer is pickable/clickable */
  pickable?: boolean;

  /** Width units (pixels or meters) */
  widthUnits?: "pixels" | "meters" | "common";

  /** Min width in pixels */
  widthMinPixels?: number;

  /** Max width in pixels */
  widthMaxPixels?: number;

  /** Width scale multiplier */
  widthScale?: number;

  /** Click handler */
  onClick?: (info: any, event: any) => void;

  /** Hover handler */
  onHover?: (info: any, event: any) => void;

  /** Map ID to attach to */
  mapId?: string;

  /** Enable cursor change on hover */
  enableCursorChange?: boolean;

  /** Additional LineLayer props */
  layerProps?: any;
}

/**
 * Line Layer Component
 */
export function DeckGLLineLayer<DataT = any>({
  id,
  data,
  getSourcePosition,
  getTargetPosition,
  getColor = () => [255, 0, 0, 255],
  getWidth = () => 1,
  visible = true,
  pickable = false,
  widthUnits = "pixels",
  widthMinPixels = 1,
  widthMaxPixels = 10,
  widthScale = 1,
  onClick,
  onHover,
  mapId = "map_1",
  enableCursorChange = false,
  layerProps = {},
}: DeckGLLineLayerProps<DataT>) {
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
      widthUnits,
      widthMinPixels,
      widthMaxPixels,
      widthScale,
      getSourcePosition,
      getTargetPosition,
      getColor,
      getWidth,
      onClick,
      onHover: combinedHoverHandler,
      parameters: { depthTest: false },
      ...layerProps,
    }),
    [
      pickable,
      widthUnits,
      widthMinPixels,
      widthMaxPixels,
      widthScale,
      getSourcePosition,
      getTargetPosition,
      getColor,
      getWidth,
      onClick,
      combinedHoverHandler,
      layerProps,
    ]
  );

  return (
    <BaseDeckGLLayer
      id={id}
      layerType={LineLayer}
      data={data}
      visible={visible}
      mapId={mapId}
      layerProps={deckLayerProps}
    />
  );
}
