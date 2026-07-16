/**
 * GridDebugLayer - Visualize pathfinding grid
 *
 * Shows grid cells color-coded by walkable/blocked status
 * - Green cells = walkable
 * - Red cells = blocked by buildings
 */

import React, { useMemo } from 'react';
import { DeckGLPolygonLayer } from '../deckgl/DeckGLPolygonLayer';
import { JumpPointSearch } from '../../game/navigation/JumpPointSearch';

interface GridDebugLayerProps {
  pathfinder: JumpPointSearch | null;
  visible: boolean;
  showWalkable?: boolean; // Show walkable cells (can be slow for large grids)
  showBlocked?: boolean; // Show blocked cells
}

export function GridDebugLayer({
  pathfinder,
  visible,
  showWalkable = false,
  showBlocked = true
}: GridDebugLayerProps) {
  const gridPolygons = useMemo(() => {
    if (!pathfinder || !visible) {
      return [];
    }

    const polygons: Array<{
      polygon: number[][][];
      color: [number, number, number, number];
      walkable: boolean;
    }> = [];

    if (showWalkable || showBlocked) {
      const cells = pathfinder.getGridCells();

      for (const cell of cells) {
        // Skip based on filters
        if (cell.walkable && !showWalkable) continue;
        if (!cell.walkable && !showBlocked) continue;

        const [minLng, minLat, maxLng, maxLat] = cell.bounds;

        const polygon = [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]];

        const color: [number, number, number, number] = cell.walkable
          ? [0, 255, 0, 30] // Green, transparent for walkable
          : [255, 0, 0, 100]; // Red, more opaque for blocked

        polygons.push({
          polygon,
          color,
          walkable: cell.walkable
        });
      }
    }

    console.log(`Grid debug: ${polygons.length} cells visualized`);
    return polygons;
  }, [pathfinder, visible, showWalkable, showBlocked]);

  if (!visible || gridPolygons.length === 0) {
    return null;
  }

  return (
    <DeckGLPolygonLayer
      id="grid-debug-layer"
      data={gridPolygons}
      getPolygon={(d) => d.polygon}
      getFillColor={(d) => d.color}
      getLineColor={() => [100, 100, 100, 100]} // Gray outline
      getLineWidth={() => 1}
      filled={true}
      stroked={true}
      pickable={false}
    />
  );
}
