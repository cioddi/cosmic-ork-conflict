/**
 * DeckGL Text Layer Component
 *
 * Reusable wrapper for DeckGL's TextLayer with react-maplibre integration.
 * Displays text labels with customizable styling and positioning.
 */

import { TextLayer } from "@deck.gl/layers";
import { BaseDeckGLLayer } from "./BaseDeckGLLayer";
import { useMemo } from "react";

export interface DeckGLTextLayerProps<DataT = any> {
  /** Unique layer ID */
  id: string;

  /** Data to render */
  data: DataT[];

  /** Get position [lng, lat] from data item */
  getPosition: (d: DataT) => [number, number];

  /** Get text string from data item */
  getText: (d: DataT) => string;

  /** Get text color [r, g, b, a] */
  getColor?: (d: DataT) => [number, number, number, number];

  /** Get text size in pixels */
  getSize?: (d: DataT) => number;

  /** Get pixel offset [x, y] from position */
  getPixelOffset?: (d: DataT) => [number, number] | [number, number];

  /** Get text anchor point */
  getTextAnchor?: (d: DataT) => "start" | "middle" | "end";

  /** Get alignment baseline */
  getAlignmentBaseline?: (d: DataT) => "top" | "center" | "bottom";

  /** Whether layer is visible */
  visible?: boolean;

  /** Whether layer is pickable/clickable */
  pickable?: boolean;

  /** Size units (pixels or meters) */
  sizeUnits?: "pixels" | "meters" | "common";

  /** Background color [r, g, b, a] */
  backgroundColor?: [number, number, number, number];

  /** Background padding [horizontal, vertical] */
  backgroundPadding?: [number, number];

  /** Outline color [r, g, b, a] */
  outlineColor?: [number, number, number, number];

  /** Outline width in pixels */
  outlineWidth?: number;

  /** Font family */
  fontFamily?: string;

  /** Font weight */
  fontWeight?: number | string;

  /** Max width in pixels (text wrapping) */
  maxWidth?: number;

  /** Word break behavior */
  wordBreak?: "break-all" | "break-word";

  /** Line height multiplier */
  lineHeight?: number;

  /** Billboard mode (always face camera) */
  billboard?: boolean;

  /** Map ID to attach to */
  mapId?: string;

  /** Additional TextLayer props */
  layerProps?: any;
}

/**
 * Text Layer Component
 */
export function DeckGLTextLayer<DataT = any>({
  id,
  data,
  getPosition,
  getText,
  getColor = () => [255, 255, 255, 255],
  getSize = () => 12,
  getPixelOffset = () => [0, 0],
  getTextAnchor = () => "middle",
  getAlignmentBaseline = () => "center",
  visible = true,
  pickable = false,
  sizeUnits = "pixels",
  backgroundColor,
  backgroundPadding,
  outlineColor,
  outlineWidth,
  fontFamily = "Inter, sans-serif",
  fontWeight = "normal",
  maxWidth,
  wordBreak,
  lineHeight,
  billboard = true,
  mapId = "map_1",
  layerProps = {},
}: DeckGLTextLayerProps<DataT>) {
  const deckLayerProps = useMemo(
    () => ({
      pickable,
      sizeUnits,
      getPosition,
      getText,
      getSize,
      getColor,
      getPixelOffset,
      getTextAnchor,
      getAlignmentBaseline,
      backgroundColor,
      backgroundPadding,
      outlineColor,
      outlineWidth,
      fontFamily,
      fontWeight,
      maxWidth,
      wordBreak,
      lineHeight,
      billboard,
      parameters: { depthTest: false },
      ...layerProps,
    }),
    [
      pickable,
      sizeUnits,
      getPosition,
      getText,
      getSize,
      getColor,
      getPixelOffset,
      getTextAnchor,
      getAlignmentBaseline,
      backgroundColor,
      backgroundPadding,
      outlineColor,
      outlineWidth,
      fontFamily,
      fontWeight,
      maxWidth,
      wordBreak,
      lineHeight,
      billboard,
      layerProps,
    ]
  );

  return (
    <BaseDeckGLLayer
      id={id}
      layerType={TextLayer}
      data={data}
      visible={visible}
      mapId={mapId}
      layerProps={deckLayerProps}
    />
  );
}
