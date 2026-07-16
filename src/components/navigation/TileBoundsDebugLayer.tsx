/**
 * TileBoundsDebugLayer - Visualize vector tile boundaries
 *
 * Shows the bounds of tiles being loaded for building extraction
 * Helps debug whether the correct tiles are being fetched
 */

import React, { useMemo } from 'react';
import { DeckGLPolygonLayer } from '../deckgl/DeckGLPolygonLayer';

interface TileBoundsDebugLayerProps {
  tiles: Array<{
    x: number;
    y: number;
    z: number;
    bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  }> | null;
  visible: boolean;
}

export function TileBoundsDebugLayer({
  tiles,
  visible
}: TileBoundsDebugLayerProps) {
  const tilePolygons = useMemo(() => {
    if (!tiles || !visible) {
      return [];
    }

    return tiles.map((tile) => {
      const [minLng, minLat, maxLng, maxLat] = tile.bounds;

      const polygon = [[
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat]
      ]];

      return {
        polygon,
        tile,
        color: [0, 100, 255, 80] as [number, number, number, number], // Blue, semi-transparent
      };
    });
  }, [tiles, visible]);

  if (!visible || tilePolygons.length === 0) {
    return null;
  }

  return (
    <DeckGLPolygonLayer
      id="tile-bounds-debug-layer"
      data={tilePolygons}
      getPolygon={(d) => d.polygon}
      getFillColor={(d) => d.color}
      getLineColor={() => [0, 100, 255, 255]} // Blue outline
      getLineWidth={() => 2}
      filled={true}
      stroked={true}
      pickable={false}
    />
  );
}
