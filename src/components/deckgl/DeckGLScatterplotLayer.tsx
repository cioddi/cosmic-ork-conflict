/**
 * DeckGL Scatterplot Layer Component
 *
 * Reusable wrapper for DeckGL's ScatterplotLayer with react-maplibre integration.
 * Displays circles/points with customizable colors, sizes, and strokes.
 */

import { BaseDeckGLLayer, useLayerCursor } from "./BaseDeckGLLayer";
import { useMemo, useCallback } from "react";

// @ts-ignore - ScatterplotLayer exists but has TypeScript export issues
const { ScatterplotLayer } = require("@deck.gl/layers");

export interface DeckGLScatterplotLayerProps<DataT = any> {
  /** Unique layer ID */
  id: string;

  /** Data to render */
  data: DataT[];

  /** Get position [lng, lat] from data item */
  getPosition: (d: DataT) => [number, number];

  /** Get radius in pixels or meters */
  getRadius: (d: DataT) => number;

  /** Get fill color [r, g, b, a] */
  getFillColor?: (d: DataT) => [number, number, number, number];

  /** Get line color [r, g, b, a] for stroke */
  getLineColor?: (d: DataT) => [number, number, number, number];

  /** Get line width in pixels */
  getLineWidth?: (d: DataT) => number;

  /** Whether layer is visible */
  visible?: boolean;

  /** Whether layer is pickable/clickable */
  pickable?: boolean;

  /** Whether to show stroke */
  stroked?: boolean;

  /** Whether to fill circles */
  filled?: boolean;

  /** Radius units (pixels or meters) */
  radiusUnits?: "pixels" | "meters" | "common";

  /** Min radius in pixels */
  radiusMinPixels?: number;

  /** Max radius in pixels */
  radiusMaxPixels?: number;

  /** Line width units */
  lineWidthUnits?: "pixels" | "meters" | "common";

  /** Min line width in pixels */
  lineWidthMinPixels?: number;

  /** Max line width in pixels */
  lineWidthMaxPixels?: number;

  /** Click handler */
  onClick?: (info: any, event: any) => void;

  /** Hover handler */
  onHover?: (info: any, event: any) => void;

  /** Map ID to attach to */
  mapId?: string;

  /** Enable cursor change on hover */
  enableCursorChange?: boolean;

  /** Additional ScatterplotLayer props */
  layerProps?: any;
}

/**
 * Scatterplot Layer Component
 */
export function DeckGLScatterplotLayer<DataT = any>({
  id,
  data,
  getPosition,
  getRadius,
  getFillColor = () => [255, 0, 0, 255],
  getLineColor = () => [0, 0, 0, 255],
  getLineWidth = () => 1,
  visible = true,
  pickable = false,
  stroked = true,
  filled = true,
  radiusUnits = "pixels",
  radiusMinPixels = 10,
  radiusMaxPixels = 50,
  lineWidthUnits = "pixels",
  lineWidthMinPixels = 1,
  lineWidthMaxPixels = 10,
  onClick,
  onHover,
  mapId = "map_1",
  enableCursorChange = false,
  layerProps = {},
}: DeckGLScatterplotLayerProps<DataT>) {
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
      stroked,
      filled,
      radiusUnits,
      radiusMinPixels,
      radiusMaxPixels,
      lineWidthUnits,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      getPosition,
      getRadius,
      getFillColor,
      getLineColor,
      getLineWidth,
      onClick,
      onHover: combinedHoverHandler,
      parameters: { depthTest: false },
      ...layerProps,
    }),
    [
      pickable,
      stroked,
      filled,
      radiusUnits,
      radiusMinPixels,
      radiusMaxPixels,
      lineWidthUnits,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      getPosition,
      getRadius,
      getFillColor,
      getLineColor,
      getLineWidth,
      onClick,
      combinedHoverHandler,
      layerProps,
    ]
  );

  return (
    <BaseDeckGLLayer
      id={id}
      layerType={ScatterplotLayer}
      data={data}
      visible={visible}
      mapId={mapId}
      layerProps={deckLayerProps}
    />
  );
}
