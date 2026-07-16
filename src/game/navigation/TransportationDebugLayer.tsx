/**
 * Debug visualization layer for the transportation network
 * Shows the actual paths derived from vector tile transportation data
 */

import { useMap } from "@mapcomponents/react-maplibre";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapboxLayer } from "@deck.gl/mapbox";
import { PathNetwork } from "./PathNetwork";
// @ts-ignore - ScatterplotLayer and LineLayer exist but have TypeScript export issues
const { ScatterplotLayer, LineLayer } = require('@deck.gl/layers');

interface TransportationDebugLayerProps {
  network: PathNetwork | null;
  visible?: boolean;
  showNodes?: boolean;
  showConnections?: boolean;
}

const TRANSPORT_NODE_COLORS = {
  road: [255, 165, 0, 255], // Orange for roads
  path: [0, 255, 0, 255],   // Green for paths/footways
  open: [0, 191, 255, 255], // Blue for open areas
  waypoint: [255, 20, 147, 255] // Pink for waypoints
};

const TRANSPORT_CONNECTION_COLOR = [100, 100, 255, 150]; // Blue connections

const DECK_TRANSPORT_NODES_ID = "debug-transport-nodes";
const DECK_TRANSPORT_CONNECTIONS_ID = "debug-transport-connections";

export default function TransportationDebugLayer({
  network,
  visible = false,
  showNodes = true,
  showConnections = true
}: TransportationDebugLayerProps) {
  const mapHook = useMap({ mapId: "map_1" });

  const nodesLayerRef = useRef<MapboxLayer<any> | null>(null);
  const connectionsLayerRef = useRef<MapboxLayer<any> | null>(null);
  const updateTimeoutRef = useRef<number>();

  // Prepare transportation node data for rendering
  const nodeData = useMemo(() => {
    if (!network || !visible || !showNodes) return [];

    const nodes: any[] = [];
    const MAX_NODES = 25000; // Limit nodes for performance

    let nodeCount = 0;
    for (const [id, node] of Array.from(network.nodes)) {
      if (nodeCount >= MAX_NODES) break;

      nodes.push({
        id,
        position: node.position,
        type: node.type,
        connectionCount: node.connections.length
      });
      nodeCount++;
    }

    return nodes;
  }, [network, visible, showNodes]);

  // Prepare transportation connection data for rendering
  const connectionData = useMemo(() => {
    if (!network || !visible || !showConnections) return [];

    const connections: any[] = [];

    // Limit connections for performance (too many lines can freeze the browser)
    const MAX_CONNECTIONS = 20000;
    let connectionCount = 0;

    for (const [sourceId, sourceNode] of Array.from(network.nodes)) {

      for (const connection of sourceNode.connections) {
        if (connectionCount >= MAX_CONNECTIONS) break;

        const targetNode = network.nodes.get(connection.targetNodeId);
        if (targetNode) {
          connections.push({
            id: `${sourceId}-${connection.targetNodeId}`,
            sourcePosition: sourceNode.position,
            targetPosition: targetNode.position,
            distance: connection.distance,
            cost: connection.cost
          });
          connectionCount++;
        } else {
          console.warn(`Target node ${connection.targetNodeId} not found for connection from ${sourceId}`);
        }
      }

      if (connectionCount >= MAX_CONNECTIONS) break;
    }

    return connections;
  }, [network, visible, showConnections]);

  // Node color accessor
  const getNodeColor = useCallback((d: any) => {
    return TRANSPORT_NODE_COLORS[d.type as keyof typeof TRANSPORT_NODE_COLORS] || [128, 128, 128, 255];
  }, []);

  // Node size accessor - bigger for more connections
  const getNodeSize = useCallback((d: any) => {
    const baseSize = 4;
    const connectionBonus = Math.min(d.connectionCount * 0.3, 3);
    return baseSize + connectionBonus;
  }, []);

  // Initialize DeckGL layers
  useEffect(() => {
    if (!mapHook.map || !visible) {
      return;
    }

    const mapInstance = mapHook.map.map;

    const addLayers = () => {
      try {
        // Add connections layer (lines) first so they appear under nodes
        if (showConnections && !connectionsLayerRef.current) {
          const connectionsLayer = new MapboxLayer({
            id: DECK_TRANSPORT_CONNECTIONS_ID,
            type: LineLayer,
            data: [],
            pickable: false,
            getSourcePosition: (d: any) => d.sourcePosition,
            getTargetPosition: (d: any) => d.targetPosition,
            getColor: TRANSPORT_CONNECTION_COLOR,
            getWidth: 2,
            widthMinPixels: 1,
            widthMaxPixels: 4,
            parameters: { depthTest: false },
          });

          connectionsLayerRef.current = connectionsLayer;
          mapInstance.addLayer(connectionsLayer as any);
        }

        // Add nodes layer (points) on top
        if (showNodes && !nodesLayerRef.current) {
          const nodesLayer = new MapboxLayer({
            id: DECK_TRANSPORT_NODES_ID,
            type: ScatterplotLayer,
            data: [],
            pickable: true,
            stroked: true,
            filled: true,
            radiusMinPixels: 3,
            radiusMaxPixels: 12,
            lineWidthMinPixels: 1,
            getPosition: (d: any) => d.position,
            getRadius: getNodeSize,
            getFillColor: getNodeColor,
            getLineColor: [0, 0, 0, 255],
            getLineWidth: 1,
            onClick: (info: any) => {
              if (info.object) {
                console.log('Transportation node clicked:', info.object);
              }
            },
            onHover: (info: any) => {
              if (!mapHook.map) return;

              const canvasParent = mapHook.map.map.getCanvas().parentElement;
              if (!canvasParent) return;

              if (info.object) {
                canvasParent.style.cursor = "pointer";
                // Could add tooltip here showing node type and connections
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
        console.error("Error creating transportation debug layers:", error);
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
          const layerIds = [DECK_TRANSPORT_CONNECTIONS_ID, DECK_TRANSPORT_NODES_ID];
          if (layerRef.current) {
            try {
              if (mapInstance.getLayer(layerIds[index])) {
                mapInstance.removeLayer(layerIds[index]);
              }
            } catch (error) {
              console.warn(`Error removing transportation layer ${layerIds[index]}:`, error);
            }

            if (layerRef.current.finalize) {
              try {
                layerRef.current.finalize();
              } catch (error) {
                console.warn(`Error finalizing transportation layer ${layerIds[index]}:`, error);
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
        console.error("Error during transportation debug layer cleanup:", error);
      }
    };
  }, [
    mapHook.map,
    visible,
    showNodes,
    showConnections,
    getNodeColor,
    getNodeSize
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
          getColor: TRANSPORT_CONNECTION_COLOR,
          getWidth: 2,
          widthMinPixels: 1,
          widthMaxPixels: 4,
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
          radiusMinPixels: 3,
          radiusMaxPixels: 12,
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
      console.error("Error updating transportation debug layers:", error);
    }
  }, [
    nodeData,
    connectionData,
    visible,
    showNodes,
    showConnections,
    getNodeColor,
    getNodeSize,
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
 * Transportation debug controls component
 */
interface TransportationDebugControlsProps {
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  showNodes: boolean;
  onShowNodesChange: (show: boolean) => void;
  showConnections: boolean;
  onShowConnectionsChange: (show: boolean) => void;
  networkInfo?: {
    nodeCount: number;
    connectionCount: number;
  };
}

export function TransportationDebugControls({
  visible,
  onVisibilityChange,
  showNodes,
  onShowNodesChange,
  showConnections,
  onShowConnectionsChange,
  networkInfo
}: TransportationDebugControlsProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 80, // Position below path network debug controls
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
        Transportation Network Debug
      </div>

      <div style={{ marginBottom: '5px' }}>
        <label>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onVisibilityChange(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          Show Transportation Layer
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
              <div>Connections: {networkInfo.connectionCount}</div>
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: '10px', color: '#888', marginTop: '10px' }}>
        <div>🟠 Roads</div>
        <div>🟢 Paths</div>
        <div>🔵 Open Areas</div>
      </div>
    </div>
  );
}