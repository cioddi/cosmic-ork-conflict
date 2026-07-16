/**
 * Debug visualization layer for the path network
 * Shows nodes and connections for debugging pathfinding
 */

import { useMap } from "@mapcomponents/react-maplibre";
import { useCallback, useEffect, useMemo, useRef } from "react";
// @ts-ignore - ScatterplotLayer and LineLayer exist but have TypeScript export issues
const { ScatterplotLayer, LineLayer } = require('@deck.gl/layers');
import { MapboxLayer } from "@deck.gl/mapbox";
import { PathNetwork, PathNode } from "./PathNetwork";

interface PathNetworkDebugLayerProps {
  network: PathNetwork | null;
  visible?: boolean;
  showNodes?: boolean;
  showConnections?: boolean;
  showNodeLabels?: boolean;
}

const NODE_COLORS = {
  road: [255, 165, 0, 200], // Orange
  path: [0, 255, 0, 200],   // Green
  open: [0, 191, 255, 200], // Deep sky blue
  waypoint: [255, 20, 147, 200] // Deep pink
};

const DECK_DEBUG_NODES_ID = "debug-path-nodes";
const DECK_DEBUG_CONNECTIONS_ID = "debug-path-connections";

export default function PathNetworkDebugLayer({
  network,
  visible = false,
  showNodes = true,
  showConnections = true,
  showNodeLabels = false
}: PathNetworkDebugLayerProps) {
  const mapHook = useMap({ mapId: "map_1" });

  const nodesLayerRef = useRef<MapboxLayer<any> | null>(null);
  const connectionsLayerRef = useRef<MapboxLayer<any> | null>(null);
  const updateTimeoutRef = useRef<number>();

  // Prepare node data for rendering
  const nodeData = useMemo(() => {
    if (!network || !visible || !showNodes) return [];

    const nodes: any[] = [];
    for (const [id, node] of Array.from(network.nodes)) {
      nodes.push({
        id,
        position: node.position,
        type: node.type,
        connectionCount: node.connections.length
      });
    }

    return nodes;
  }, [network, visible, showNodes]);

  // Prepare connection data for rendering
  const connectionData = useMemo(() => {
    if (!network || !visible || !showConnections) return [];

    const connections: any[] = [];
    for (const [sourceId, sourceNode] of Array.from(network.nodes)) {
      for (const connection of sourceNode.connections) {
        const targetNode = network.nodes.get(connection.targetNodeId);
        if (targetNode) {
          connections.push({
            id: `${sourceId}-${connection.targetNodeId}`,
            sourcePosition: sourceNode.position,
            targetPosition: targetNode.position,
            distance: connection.distance,
            cost: connection.cost
          });
        }
      }
    }

    return connections;
  }, [network, visible, showConnections]);

  // Node color accessor
  const getNodeColor = useCallback((d: any) => {
    return NODE_COLORS[d.type as keyof typeof NODE_COLORS] || [128, 128, 128, 200];
  }, []);

  // Node size accessor
  const getNodeSize = useCallback((d: any) => {
    // Size based on connection count
    const baseSize = 3;
    const connectionBonus = Math.min(d.connectionCount * 0.5, 5);
    return baseSize + connectionBonus;
  }, []);

  // Connection color accessor (based on cost)
  const getConnectionColor = useCallback((d: any) => {
    // Color based on cost - green for low cost, red for high cost
    const normalizedCost = Math.min(d.cost / 100, 1); // Normalize to 0-1
    const red = Math.floor(255 * normalizedCost);
    const green = Math.floor(255 * (1 - normalizedCost));
    return [red, green, 0, 100];
  }, []);

  // Connection width accessor
  const getConnectionWidth = useCallback((d: any) => {
    // Thicker lines for shorter distances (more important connections)
    return Math.max(1, 5 - (d.distance / 50));
  }, []);

  // Initialize DeckGL layers
  useEffect(() => {
    if (!mapHook.map || !visible) {
      return;
    }

    const mapInstance = mapHook.map.map;

    const addLayers = () => {
      try {
        // Add connections layer (lines)
        if (showConnections && !connectionsLayerRef.current) {
          const connectionsLayer = new MapboxLayer({
            id: DECK_DEBUG_CONNECTIONS_ID,
            type: LineLayer,
            data: [],
            pickable: false,
            getSourcePosition: (d: any) => d.sourcePosition,
            getTargetPosition: (d: any) => d.targetPosition,
            getColor: getConnectionColor,
            getWidth: getConnectionWidth,
            widthMinPixels: 1,
            widthMaxPixels: 10,
            parameters: { depthTest: false },
          });

          connectionsLayerRef.current = connectionsLayer;
          mapInstance.addLayer(connectionsLayer as any);
        }

        // Add nodes layer (points)
        if (showNodes && !nodesLayerRef.current) {
          const nodesLayer = new MapboxLayer({
            id: DECK_DEBUG_NODES_ID,
            type: ScatterplotLayer,
            data: [],
            pickable: true,
            stroked: true,
            filled: true,
            radiusMinPixels: 2,
            radiusMaxPixels: 15,
            lineWidthMinPixels: 1,
            getPosition: (d: any) => d.position,
            getRadius: getNodeSize,
            getFillColor: getNodeColor,
            getLineColor: [0, 0, 0, 255],
            getLineWidth: 1,
            onClick: (info: any) => {
              if (info.object) {
                console.log('Path node clicked:', info.object);
              }
            },
            onHover: (info: any) => {
              if (!mapHook.map) return;

              const canvasParent = mapHook.map.map.getCanvas().parentElement;
              if (!canvasParent) return;

              if (info.object) {
                canvasParent.style.cursor = "pointer";
                // Could add tooltip here
              } else {
                canvasParent.style.cursor = "";
              }
            },
            parameters: { depthTest: false },
          });

          nodesLayerRef.current = nodesLayer;
          mapInstance.addLayer(nodesLayer as any);
        }
      } catch (error) {
        console.error("Error creating debug layers:", error);
      }
    };

    if (mapInstance.isStyleLoaded()) {
      addLayers();
    } else {
      const handleStyle = () => {
        addLayers();
      };
      mapInstance.once("styledata", handleStyle);
      return () => {
        mapInstance.off("styledata", handleStyle);
      };
    }

    // Cleanup function
    return () => {
      try {
        [connectionsLayerRef, nodesLayerRef].forEach((layerRef, index) => {
          const layerIds = [DECK_DEBUG_CONNECTIONS_ID, DECK_DEBUG_NODES_ID];
          if (layerRef.current) {
            try {
              if (mapInstance.getLayer(layerIds[index])) {
                mapInstance.removeLayer(layerIds[index]);
              }
            } catch (error) {
              console.warn(`Error removing layer ${layerIds[index]}:`, error);
            }

            if (layerRef.current.finalize) {
              try {
                layerRef.current.finalize();
              } catch (error) {
                console.warn(`Error finalizing layer ${layerIds[index]}:`, error);
              }
            }
            layerRef.current = null;
          }
        });

        const canvasParent = mapInstance.getCanvas().parentElement;
        if (canvasParent) {
          canvasParent.style.cursor = "";
        }
      } catch (error) {
        console.error("Error during debug layer cleanup:", error);
      }
    };
  }, [
    mapHook.map,
    visible,
    showNodes,
    showConnections,
    getNodeColor,
    getNodeSize,
    getConnectionColor,
    getConnectionWidth
  ]);

  // Update layer data
  useEffect(() => {
    if (!visible) return;

    try {
      // Update connections layer
      if (connectionsLayerRef.current && showConnections) {
        connectionsLayerRef.current.setProps({
          data: connectionData,
          visible: connectionData.length > 0,
          getSourcePosition: (d: any) => d.sourcePosition,
          getTargetPosition: (d: any) => d.targetPosition,
          getColor: getConnectionColor,
          getWidth: getConnectionWidth,
          widthMinPixels: 1,
          widthMaxPixels: 10,
          pickable: false,
          parameters: { depthTest: false },
        });
      }

      // Update nodes layer
      if (nodesLayerRef.current && showNodes) {
        nodesLayerRef.current.setProps({
          data: nodeData,
          visible: nodeData.length > 0,
          getPosition: (d: any) => d.position,
          getRadius: getNodeSize,
          getFillColor: getNodeColor,
          getLineColor: [0, 0, 0, 255],
          getLineWidth: 1,
          radiusMinPixels: 2,
          radiusMaxPixels: 15,
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          pickable: true,
          parameters: { depthTest: false },
        });
      }

      // Throttled map repaint
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = window.setTimeout(() => {
        mapHook.map?.map.triggerRepaint();
      }, 16); // ~60fps throttling

    } catch (error) {
      console.error("Error updating debug layers:", error);
    }
  }, [
    nodeData,
    connectionData,
    visible,
    showNodes,
    showConnections,
    getNodeColor,
    getNodeSize,
    getConnectionColor,
    getConnectionWidth,
    mapHook.map
  ]);

  // Cleanup update timeout
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Hide layers when not visible
  useEffect(() => {
    if (!visible) {
      if (nodesLayerRef.current) {
        nodesLayerRef.current.setProps({ visible: false });
      }
      if (connectionsLayerRef.current) {
        connectionsLayerRef.current.setProps({ visible: false });
      }

      if (mapHook.map) {
        mapHook.map.map.triggerRepaint();
      }
    }
  }, [visible, mapHook.map]);

  return null; // This component only manages DeckGL layers
}

/**
 * Debug controls component
 */
interface PathNetworkDebugControlsProps {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  showNodes: boolean;
  onShowNodesChange: (show: boolean) => void;
  showConnections: boolean;
  onShowConnectionsChange: (show: boolean) => void;
  networkInfo?: {
    nodeCount: number;
    spatialCells: number;
  };
}

export function PathNetworkDebugControls({
  visible,
  onVisibilityChange,
  showNodes,
  onShowNodesChange,
  showConnections,
  onShowConnectionsChange,
  networkInfo
}: PathNetworkDebugControlsProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
        Path Network Debug
      </div>

      <div style={{ marginBottom: '5px' }}>
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          Show Debug Layer
        </label>
      </div>

      {visible && (
        <>
          <div style={{ marginBottom: '5px' }}>
            <label>
              <input
                type="checkbox"
                checked={showNodes}
                onChange={(e) => onShowNodesChange(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Show Nodes
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={showConnections}
                onChange={(e) => onShowConnectionsChange(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Show Connections
            </label>
          </div>

          {networkInfo && (
            <div style={{ fontSize: '10px', color: '#ccc' }}>
              <div>Nodes: {networkInfo.nodeCount}</div>
              <div>Spatial Cells: {networkInfo.spatialCells}</div>
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: '10px', color: '#888', marginTop: '10px' }}>
        <div>🟠 Roads</div>
        <div>🟢 Paths</div>
        <div>🔵 Open Areas</div>
        <div>🟣 Waypoints</div>
      </div>
    </div>
  );
}