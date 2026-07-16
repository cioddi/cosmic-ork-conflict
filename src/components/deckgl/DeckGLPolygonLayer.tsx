/**
 * DeckGL Polygon Layer Component
 *
 * Reusable wrapper for DeckGL's PolygonLayer with react-maplibre integration.
 * Displays filled polygons with customizable colors and strokes.
 */

import { BaseDeckGLLayer, useLayerCursor } from "./BaseDeckGLLayer";
import { useMemo, useCallback } from "react";

// @ts-ignore - PolygonLayer exists but has TypeScript export issues
const { PolygonLayer } = require("@deck.gl/layers");

export interface DeckGLPolygonLayerProps<DataT = any> {
  /** Unique layer ID */
  id: string;

  /** Data to render */
  data: DataT[];

  /** Get polygon coordinates from data item */
  getPolygon: (d: DataT) => number[][][];

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

  /** Whether to fill polygons */
  filled?: boolean;

  /** Elevation (for 3D) */
  getElevation?: (d: DataT) => number;

  /** Whether polygons are extruded (3D) */
  extruded?: boolean;

  /** Whether to enable wireframe rendering */
  wireframe?: boolean;

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

  /** Additional PolygonLayer props */
  layerProps?: any;
}

/**
 * Polygon Layer Component
 */
export function DeckGLPolygonLayer<DataT = any>({
  id,
  data,
  getPolygon,
  getFillColor = () => [255, 0, 0, 100],
  getLineColor = () => [0, 0, 0, 255],
  getLineWidth = () => 1,
  visible = true,
  pickable = false,
  stroked = true,
  filled = true,
  getElevation = () => 0,
  extruded = false,
  wireframe = false,
  lineWidthUnits = "pixels",
  lineWidthMinPixels = 1,
  lineWidthMaxPixels = 10,
  onClick,
  onHover,
  mapId = "map_1",
  enableCursorChange = false,
  layerProps = {},
}: DeckGLPolygonLayerProps<DataT>) {
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
      extruded,
      wireframe,
      lineWidthUnits,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      getPolygon,
      getFillColor,
      getLineColor,
      getLineWidth,
      getElevation,
      onClick,
      onHover: combinedHoverHandler,
      parameters: { depthTest: false },
      ...layerProps,
    }),
    [
      pickable,
      stroked,
      filled,
      extruded,
      wireframe,
      lineWidthUnits,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      getPolygon,
      getFillColor,
      getLineColor,
      getLineWidth,
      getElevation,
      onClick,
      combinedHoverHandler,
      layerProps,
    ]
  );

  return (
    <BaseDeckGLLayer
      id={id}
      layerType={PolygonLayer}
      data={data}
      visible={visible}
      mapId={mapId}
      layerProps={deckLayerProps}
    />
  );
}
