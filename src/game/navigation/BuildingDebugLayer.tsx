/**
 * BuildingDebugLayer - Visualize extracted buildings for debugging
 *
 * Uses the new DeckGL components to display building polygons
 */

import { useMemo } from "react";
import { DeckGLLineLayer } from "../../components/deckgl";
import type { BuildingIndex } from "./BuildingExtractor";

export interface BuildingDebugLayerProps {
  buildingIndex: BuildingIndex | null;
  visible?: boolean;
  mapId?: string;
}

export function BuildingDebugLayer({
  buildingIndex,
  visible = false,
  mapId = "map_1",
}: BuildingDebugLayerProps) {
  // Convert building polygons to line segments for rendering
  const buildingLines = useMemo(() => {
    if (!buildingIndex || !visible) return [];

    const lines: any[] = [];

    for (const building of Array.from(buildingIndex.buildings.values())) {
      // Draw each ring of the building
      for (const ring of building.coordinates) {
        for (let i = 0; i < ring.length - 1; i++) {
          lines.push({
            id: `${building.id}_${i}`,
            from: [ring[i][0], ring[i][1]] as [number, number],
            to: [ring[i + 1][0], ring[i + 1][1]] as [number, number],
          });
        }
      }
    }

    return lines;
  }, [buildingIndex, visible]);

  if (!visible || !buildingIndex) {
    return null;
  }

  return (
    <DeckGLLineLayer
      id="building-debug-layer"
      data={buildingLines}
      getSourcePosition={(d) => d.from}
      getTargetPosition={(d) => d.to}
      getColor={() => [255, 0, 0, 200]} // Red buildings
      getWidth={() => 2}
      widthMinPixels={1}
      widthMaxPixels={4}
      visible={visible}
      mapId={mapId}
    />
  );
}

/**
 * Building debug controls component
 */
interface BuildingDebugControlsProps {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  buildingCount?: number;
  cellCount?: number;
}

export function BuildingDebugControls({
  visible,
  onVisibilityChange,
  buildingCount = 0,
  cellCount = 0,
}: BuildingDebugControlsProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 160,
        right: 10,
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "12px",
        fontFamily: "monospace",
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
        Building Debug Layer
      </div>

      <div style={{ marginBottom: "5px" }}>
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            style={{ marginRight: "5px" }}
          />
          Show Buildings
        </label>
      </div>

      {visible && (
        <div style={{ fontSize: "10px", color: "#ccc", marginTop: "10px" }}>
          <div>Buildings: {buildingCount}</div>
          <div>Spatial Cells: {cellCount}</div>
        </div>
      )}

      <div style={{ fontSize: "10px", color: "#888", marginTop: "10px" }}>
        <div>🔴 Building Boundaries</div>
      </div>
    </div>
  );
}
