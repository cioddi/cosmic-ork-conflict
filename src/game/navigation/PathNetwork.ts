/**
 * PathNetwork - Generates a precomputed navigation network from vector tiles
 * This creates a graph of walkable paths that can be used for fast pathfinding
 */

import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

export interface PathNode {
  id: string;
  position: [number, number]; // [lng, lat]
  connections: PathEdge[];
  type: 'road' | 'path' | 'open' | 'waypoint';
}

export interface PathEdge {
  targetNodeId: string;
  distance: number;
  cost: number; // Higher cost for difficult terrain
}

export interface PathNetwork {
  nodes: Map<string, PathNode>;
  spatialIndex: SpatialIndex;
  bounds: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
}

export interface SpatialIndex {
  gridSize: number;
  cells: Map<string, string[]>; // cellKey -> nodeIds
}

export interface NetworkGenerationOptions {
  styleUrl: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  zoom: number;
  roadLayers: string[]; // e.g., ['road', 'path', 'waterway']
  buildingLayers: string[]; // e.g., ['building', 'landuse']
  gridSpacing: number; // meters between generated waypoints
  maxNodeDistance: number; // max distance for node connections
}

/**
 * Generates a path network from vector tile data
 */
export class PathNetworkGenerator {
  private options: NetworkGenerationOptions;
  private network: PathNetwork;

  constructor(options: NetworkGenerationOptions) {
    this.options = options;
    this.network = {
      nodes: new Map(),
      spatialIndex: {
        gridSize: 0.001, // ~100m at equator
        cells: new Map()
      },
      bounds: {
        minLng: options.bounds[0],
        maxLng: options.bounds[2],
        minLat: options.bounds[1],
        maxLat: options.bounds[3]
      }
    };
  }

  /**
   * Main generation method
   */
  async generateNetwork(): Promise<PathNetwork> {
    console.log('Generating transportation-based path network...');

    // Step 1: Extract transportation network from vector tiles
    await this.extractTransportationNetwork();

    // Step 2: Connect nearby nodes at intersections
    this.connectIntersections();

    // Step 3: Build spatial index for fast lookups
    this.buildSpatialIndex();

    console.log(`Generated transportation network with ${this.network.nodes.size} nodes`);
    return this.network;
  }

  /**
   * Extract walkable areas (everything except buildings, water, etc.)
   */
  private async extractWalkableAreas(): Promise<any[]> {
    const tiles = this.getTilesForBounds();
    const walkableAreas: any[] = [];

    for (const tile of tiles) {
      try {
        const tileData = await this.fetchVectorTile(tile);

        // Process building layers to identify non-walkable areas
        for (const layerName of this.options.buildingLayers) {
          const layer = (tileData.layers as any)[layerName];
          if (!layer) continue;

          for (let i = 0; i < layer.length; i++) {
            // const feature = layer.feature(i);
            // const geometry = feature.loadGeometry();

            // Convert to GeoJSON and mark as non-walkable
            // This is used to exclude areas from waypoint generation
          }
        }
      } catch (error) {
        console.warn(`Failed to process tile ${tile.z}/${tile.x}/${tile.y}:`, error);
      }
    }

    return walkableAreas;
  }

  /**
   * Extract transportation network from vector tiles for walking paths
   */
  private async extractTransportationNetwork(): Promise<PathNode[]> {
    const tiles = this.getTilesForBounds();
    const transportationNodes: PathNode[] = [];
    const nodeMap = new Map<string, PathNode>(); // Deduplicate nodes by position
    let nodeIdCounter = 0;

    console.log(`Processing ${tiles.length} tiles for transportation network...`);

    for (const tile of tiles) {
      try {
        const tileData = await this.fetchVectorTile(tile);

        // Look for transportation layer specifically
        const transportationLayer = (tileData.layers as any)['transportation'] ||
                                   (tileData.layers as any)['road'] ||
                                   (tileData.layers as any)['highway'];

        if (!transportationLayer) {
          console.warn(`No transportation layer found in tile ${tile.z}/${tile.x}/${tile.y}`);
          continue;
        }


        for (let i = 0; i < transportationLayer.length; i++) {
          const feature = transportationLayer.feature(i);
          const properties = feature.properties;
          const geometry = feature.loadGeometry();

          // Only process walkable transportation types
          if (!this.isWalkableTransportation(properties)) {
            continue;
          }

          // Process each geometry part (could be multilinestring)
          for (let partIndex = 0; partIndex < geometry.length; partIndex++) {
            const coords = this.tileCoordsToLngLat(geometry[partIndex], tile);

            if (coords.length < 2) continue; // Need at least 2 points for a line

            // Create nodes for each coordinate and connect them
            let prevNode: PathNode | null = null;

            for (let coordIndex = 0; coordIndex < coords.length; coordIndex++) {
              const position = coords[coordIndex];
              const positionKey = `${position[0].toFixed(6)},${position[1].toFixed(6)}`;

              // Reuse existing node if it exists at this position
              let node = nodeMap.get(positionKey);

              if (!node) {
                const nodeId = `transport_${nodeIdCounter++}`;
                node = {
                  id: nodeId,
                  position: position,
                  connections: [],
                  type: this.getTransportationType(properties)
                };

                nodeMap.set(positionKey, node);
                transportationNodes.push(node);
                this.network.nodes.set(nodeId, node);
              }

              // Connect to previous node in the linestring
              if (prevNode && prevNode !== node) {
                this.connectNodes(prevNode, node);
              }

              prevNode = node;
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process tile ${tile.z}/${tile.x}/${tile.y}:`, error);
      }
    }

    return transportationNodes;
  }

  /**
   * Generate a grid of waypoints in open areas
   */
  private generateWaypointGrid(walkableAreas: any[]): PathNode[] {
    const waypoints: PathNode[] = [];
    const { bounds } = this.network;
    const gridSpacing = this.options.gridSpacing / 111000; // Convert meters to degrees (rough)

    let nodeIdCounter = 0;

    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += gridSpacing) {
      for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += gridSpacing) {
        // Check if this position is in a walkable area
        if (this.isPositionWalkable([lng, lat], walkableAreas)) {
          const nodeId = `waypoint_${nodeIdCounter++}`;
          const node: PathNode = {
            id: nodeId,
            position: [lng, lat],
            connections: [],
            type: 'waypoint'
          };

          waypoints.push(node);
          this.network.nodes.set(nodeId, node);
        }
      }
    }

    return waypoints;
  }

  /**
   * Connect all nodes in the network
   */
  private connectNetworkNodes(roadNodes: PathNode[], waypoints: PathNode[]): void {
    const allNodes = [...roadNodes, ...waypoints];

    // Connect waypoints to nearby waypoints and road nodes
    for (const node of allNodes) {
      const nearbyNodes = this.findNearbyNodes(node.position, allNodes);

      for (const nearbyNode of nearbyNodes) {
        if (nearbyNode.id === node.id) continue;

        const distance = this.calculateDistance(node.position, nearbyNode.position);
        if (distance <= this.options.maxNodeDistance) {
          // Check if connection is valid (no buildings in the way)
          if (this.isConnectionValid(node.position, nearbyNode.position)) {
            const cost = this.calculateMovementCost(node, nearbyNode, distance);

            node.connections.push({
              targetNodeId: nearbyNode.id,
              distance,
              cost
            });
          }
        }
      }
    }
  }

  /**
   * Build spatial index for fast node lookups
   */
  private buildSpatialIndex(): void {
    const { gridSize } = this.network.spatialIndex;

    for (const [nodeId, node] of Array.from(this.network.nodes)) {
      const cellKey = this.getCellKey(node.position, gridSize);

      if (!this.network.spatialIndex.cells.has(cellKey)) {
        this.network.spatialIndex.cells.set(cellKey, []);
      }

      this.network.spatialIndex.cells.get(cellKey)!.push(nodeId);
    }
  }

  // Utility methods
  private getTilesForBounds() {
    const { bounds, zoom } = this.options;

    // WhereGroup tile server only goes up to zoom 14
    const MAX_ZOOM = 14;
    const effectiveZoom = Math.min(zoom, MAX_ZOOM);

    const tiles = [];

    // Convert bounds to tile coordinates using proper Web Mercator math
    const minTileX = this.lngToTileX(bounds[0], effectiveZoom);
    const maxTileX = this.lngToTileX(bounds[2], effectiveZoom);
    const minTileY = this.latToTileY(bounds[3], effectiveZoom); // Note: Y is flipped
    const maxTileY = this.latToTileY(bounds[1], effectiveZoom);

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        tiles.push({ x, y, z: effectiveZoom });
      }
    }

    return tiles;
  }

  // Proper Web Mercator tile math
  private lngToTileX(lng: number, zoom: number): number {
    return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  }

  private latToTileY(lat: number, zoom: number): number {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  private async fetchVectorTile(tile: { x: number; y: number; z: number }) {
    // Validate zoom level before making request
    if (tile.z > 14) {
      console.warn(`Skipping tile ${tile.z}/${tile.x}/${tile.y} - zoom level ${tile.z} exceeds server maximum of 14`);
      return { layers: {} };
    }

    const tileUrl = `https://wms.wheregroup.com/tileserver/tile/world-0-14/${tile.z}/${tile.x}/${tile.y}.pbf`;

    try {
      // Use the same request format that works
      const response = await fetch(tileUrl, {
        referrer: window.location.origin + "/",
        body: null,
        method: "GET",
        mode: "cors",
        credentials: "omit"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength === 0) {
        throw new Error('Empty response body');
      }

      // Parse the Protobuf Vector Tile
      const pbf = new PbfReader(new Uint8Array(arrayBuffer));
      const vectorTile = new VectorTile(pbf);


      return {
        layers: vectorTile.layers
      };

    } catch (error) {
      console.error(`✗ Failed to fetch tile ${tile.z}/${tile.x}/${tile.y}:`, error);

      // If this is a CORS error, suggest potential solutions
      if (error instanceof TypeError && error.message.includes('CORS')) {
        console.warn('CORS error detected. This tile server may not allow direct browser access.');
        console.warn('Consider using a proxy server or different tile source.');
      }

      return {
        layers: {}
      };
    }
  }


  private tileCoordsToLngLat(coords: any[], tile: { x: number; y: number; z: number }): [number, number][] {
    // Convert tile coordinates to lng/lat using proper Web Mercator projection
    return coords.map(coord => {
      // Vector tile coordinates are in 0-4096 extent (not 0-512)
      const extent = 4096;

      // Convert to tile fraction
      const x = coord.x / extent;
      const y = coord.y / extent;

      // Convert to world coordinates
      const worldX = tile.x + x;
      const worldY = tile.y + y;

      // Convert to lat/lng using Web Mercator formula
      const n = Math.pow(2, tile.z);
      const lng = (worldX / n) * 360 - 180;
      const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / n)));
      const lat = (latRad * 180) / Math.PI;

      return [lng, lat] as [number, number];
    });
  }

  private getNodeType(properties: any): PathNode['type'] {
    // Determine node type based on properties
    if (properties.highway) return 'road';
    if (properties.footway || properties.path) return 'path';
    return 'open';
  }

  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    // Haversine distance in meters
    const R = 6371000; // Earth's radius in meters
    const φ1 = pos1[1] * Math.PI / 180;
    const φ2 = pos2[1] * Math.PI / 180;
    const Δφ = (pos2[1] - pos1[1]) * Math.PI / 180;
    const Δλ = (pos2[0] - pos1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private calculateCost(properties: any, distance: number): number {
    // Base cost is distance, but can be modified by terrain type
    let multiplier = 1;

    if (properties.highway === 'primary') multiplier = 0.8; // Faster on main roads
    if (properties.surface === 'unpaved') multiplier = 1.5; // Slower on unpaved

    return distance * multiplier;
  }

  /**
   * Check if a transportation feature is walkable based on real vector tile data
   * Only includes major roads for a cleaner, less dense network
   */
  private isWalkableTransportation(properties: any): boolean {
    const transportClass = properties.class || properties.subclass;

    if (!transportClass) return false;

    // Only include major road types for a cleaner network
    const majorRoadTypes = [
      'primary',         // Primary roads
      'secondary',       // Secondary roads
      'tertiary',        // Tertiary roads
      'trunk',           // Trunk roads
      'residential',     // Residential streets
      'living_street'    // Living streets
    ];

    return majorRoadTypes.includes(transportClass);
  }

  /**
   * Determine transportation node type from properties
   */
  private getTransportationType(properties: any): PathNode['type'] {
    const transportClass = properties.class || properties.highway || properties.type;

    switch (transportClass) {
      case 'path':
      case 'footway':
      case 'pedestrian':
      case 'steps':
        return 'path';
      case 'cycleway':
      case 'track':
      case 'service':
        return 'path';
      case 'residential':
      case 'living_street':
      case 'tertiary':
      case 'secondary':
      case 'primary':
      case 'trunk':
      case 'unclassified':
        return 'road';
      default:
        return 'open';
    }
  }

  /**
   * Connect two nodes bidirectionally
   */
  private connectNodes(node1: PathNode, node2: PathNode): void {
    const distance = this.calculateDistance(node1.position, node2.position);
    const cost = distance; // Simple cost for now

    // Add connection from node1 to node2
    if (!node1.connections.find(conn => conn.targetNodeId === node2.id)) {
      node1.connections.push({
        targetNodeId: node2.id,
        distance,
        cost
      });
    }

    // Add connection from node2 to node1
    if (!node2.connections.find(conn => conn.targetNodeId === node1.id)) {
      node2.connections.push({
        targetNodeId: node1.id,
        distance,
        cost
      });
    }
  }

  private calculateMovementCost(node1: PathNode, node2: PathNode, distance: number): number {
    let multiplier = 1;

    // Different costs for different terrain types
    if (node1.type === 'road' && node2.type === 'road') multiplier = 0.8;
    if (node1.type === 'waypoint' && node2.type === 'waypoint') multiplier = 1.2;

    return distance * multiplier;
  }

  private isPositionWalkable(_position: [number, number], _walkableAreas: any[]): boolean {
    // Check if position is not inside buildings or other obstacles
    // This is a simplified check - in practice you'd do proper polygon intersection
    return true;
  }

  private findNearbyNodes(position: [number, number], nodes: PathNode[]): PathNode[] {
    // Simple distance-based search
    // In practice, use spatial index for efficiency
    return nodes.filter(node => {
      const distance = this.calculateDistance(position, node.position);
      return distance <= this.options.maxNodeDistance;
    });
  }

  private isConnectionValid(_pos1: [number, number], _pos2: [number, number]): boolean {
    // Check if direct line between positions doesn't intersect buildings
    // This is a simplified check
    return true;
  }

  private getCellKey(position: [number, number], gridSize: number): string {
    const x = Math.floor(position[0] / gridSize);
    const y = Math.floor(position[1] / gridSize);
    return `${x},${y}`;
  }

  /**
   * Connect nearby nodes at intersections to create a connected network
   */
  private connectIntersections(): void {
    const nodes = Array.from(this.network.nodes.values());
    const INTERSECTION_DISTANCE = 0.0001; // ~10 meters in degrees

    for (let i = 0; i < nodes.length; i++) {
      const node1 = nodes[i];

      for (let j = i + 1; j < nodes.length; j++) {
        const node2 = nodes[j];

        // Skip if already connected
        if (node1.connections.find(conn => conn.targetNodeId === node2.id)) {
          continue;
        }

        const distance = this.calculateDistance(node1.position, node2.position);

        // Connect nodes that are very close (likely intersections)
        if (distance <= INTERSECTION_DISTANCE) {
          this.connectNodes(node1, node2);
        }
      }
    }
  }
}

/**
 * Fast pathfinding using the precomputed network
 */
export class NetworkPathfinder {
  private network: PathNetwork;

  constructor(network: PathNetwork) {
    this.network = network;
  }

  /**
   * Find path between two positions using A* on the network
   */
  findPath(start: [number, number], end: [number, number]): [number, number][] {
    // Find nearest nodes to start and end positions
    const startNode = this.findNearestNode(start);
    const endNode = this.findNearestNode(end);

    if (!startNode || !endNode) {
      return []; // No path found
    }

    // Run A* algorithm on the network
    const path = this.astar(startNode, endNode);

    // Convert node path to coordinate path
    const coordinatePath: [number, number][] = [start];

    for (const nodeId of path) {
      const node = this.network.nodes.get(nodeId);
      if (node) {
        coordinatePath.push(node.position);
      }
    }

    coordinatePath.push(end);
    return coordinatePath;
  }

  /**
   * Find the nearest node to a given position using spatial index
   */
  private findNearestNode(position: [number, number]): PathNode | null {
    const { gridSize } = this.network.spatialIndex;
    const cellKey = this.getCellKey(position, gridSize);

    // Check current cell and surrounding cells
    const cellsToCheck = [
      cellKey,
      ...this.getSurroundingCells(cellKey)
    ];

    let nearestNode: PathNode | null = null;
    let nearestDistance = Infinity;

    for (const cell of cellsToCheck) {
      const nodeIds = this.network.spatialIndex.cells.get(cell) || [];

      for (const nodeId of nodeIds) {
        const node = this.network.nodes.get(nodeId);
        if (!node) continue;

        const distance = this.calculateDistance(position, node.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestNode = node;
        }
      }
    }

    return nearestNode;
  }

  /**
   * A* pathfinding algorithm
   */
  private astar(startNode: PathNode, endNode: PathNode): string[] {
    const openSet = new Set([startNode.id]);
    const closedSet = new Set<string>(); // Add closed set to prevent revisiting
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, this.heuristic(startNode, endNode));

    let iterations = 0;
    const MAX_ITERATIONS = 10000; // Prevent infinite loops

    while (openSet.size > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Find node with lowest fScore
      let current = '';
      let lowestF = Infinity;

      for (const nodeId of Array.from(openSet)) {
        const f = fScore.get(nodeId) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nodeId;
        }
      }

      if (current === endNode.id) {
        // Reconstruct path
        const path = [current];
        while (cameFrom.has(current)) {
          current = cameFrom.get(current)!;
          path.unshift(current);
        }
        console.log(`A* found path in ${iterations} iterations with ${path.length} nodes`);
        return path;
      }

      openSet.delete(current);
      closedSet.add(current); // Mark as visited

      const currentNode = this.network.nodes.get(current);
      if (!currentNode) continue;

      for (const edge of currentNode.connections) {
        const neighbor = edge.targetNodeId;

        // Skip if already processed
        if (closedSet.has(neighbor)) {
          continue;
        }

        const tentativeG = (gScore.get(current) || 0) + edge.cost;

        // Only process if this is a better path
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tentativeG >= (gScore.get(neighbor) || Infinity)) {
          continue;
        }

        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);

        const neighborNode = this.network.nodes.get(neighbor);
        if (neighborNode) {
          fScore.set(neighbor, tentativeG + this.heuristic(neighborNode, endNode));
        }
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`A* hit iteration limit (${MAX_ITERATIONS}) - possible infinite loop`);
    }

    return []; // No path found
  }

  private heuristic(node1: PathNode, node2: PathNode): number {
    return this.calculateDistance(node1.position, node2.position);
  }

  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = pos1[1] * Math.PI / 180;
    const φ2 = pos2[1] * Math.PI / 180;
    const Δφ = (pos2[1] - pos1[1]) * Math.PI / 180;
    const Δλ = (pos2[0] - pos1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private getCellKey(position: [number, number], gridSize: number): string {
    const x = Math.floor(position[0] / gridSize);
    const y = Math.floor(position[1] / gridSize);
    return `${x},${y}`;
  }

  private getSurroundingCells(cellKey: string): string[] {
    const [x, y] = cellKey.split(',').map(Number);
    const surrounding = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        surrounding.push(`${x + dx},${y + dy}`);
      }
    }

    return surrounding;
  }
}
