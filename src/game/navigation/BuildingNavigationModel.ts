import { Feature, MultiPolygon, Polygon } from "geojson";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import * as turf from "@turf/turf";

import {
  BBox,
  MercatorPoint,
  TileCoord,
  distanceOnMercator,
  expandBBox,
  projectLonLatToMercator,
  tilesForBBox,
  unprojectMercatorToLonLat,
} from "./TileUtils";
// import EnhancedPathfinder from "./EnhancedPathfinder";

type BuildingFeature = Feature<Polygon>;

interface MercatorBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PreparedBuilding {
  feature: BuildingFeature;
  bbox: BBox;
  mercBBox: MercatorBBox;
}

interface GridNode {
  lon: number;
  lat: number;
  merc: MercatorPoint;
  walkable: boolean;
}

interface GridIndex {
  row: number;
  col: number;
}

interface BuildingLayerInfo {
  sourceLayer: string;
  tiles: string[];
  minzoom?: number;
  maxzoom?: number;
}

export interface BuildingNavigationOptions {
  areaPolygons: Feature<Polygon | MultiPolygon>[];
  styleUrl: string;
  zoom?: number;
  cellSizeMeters?: number;
  buildingLayerHints?: string[];
  tilePaddingMeters?: number;
  clearanceMeters?: number;
}

const DEFAULT_BUILDING_LAYER_HINTS = ["building", "buildings"];
const DEFAULT_ZOOM_LEVEL = 14;
const DEFAULT_CELL_SIZE_METERS = 12;
const DEFAULT_TILE_PADDING_METERS = 120;

const styleCache = new Map<string, any>();
const tileJsonCache = new Map<string, any>();
const tileFeatureCache = new Map<string, BuildingFeature[]>();

class PriorityQueue<T> {
  private heap: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number) {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    const top = this.heap[0].item;
    const last = this.heap.pop();
    if (last && this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    let idx = index;
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.heap[parent].priority <= this.heap[idx].priority) {
        break;
      }
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }

  private bubbleDown(index: number) {
    let idx = index;
    const length = this.heap.length;
    while (true) {
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      let smallest = idx;

      if (
        left < length &&
        this.heap[left].priority < this.heap[smallest].priority
      ) {
        smallest = left;
      }

      if (
        right < length &&
        this.heap[right].priority < this.heap[smallest].priority
      ) {
        smallest = right;
      }

      if (smallest === idx) {
        break;
      }

      [this.heap[idx], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[idx],
      ];
      idx = smallest;
    }
  }
}

function flattenPolygonFeature(feature: Feature<Polygon | MultiPolygon>): BuildingFeature[] {
  if (feature.geometry.type === "Polygon") {
    return [feature as BuildingFeature];
  }

  const multi = feature.geometry.coordinates;
  return multi.map((coordinates) => ({
    type: "Feature",
    properties: feature.properties ?? {},
    geometry: {
      type: "Polygon",
      coordinates,
    },
  }));
}

function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function toMercatorBBox(bbox: BBox): MercatorBBox {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bottomLeft = projectLonLatToMercator(minLon, minLat);
  const topRight = projectLonLatToMercator(maxLon, maxLat);

  return {
    minX: Math.min(bottomLeft.x, topRight.x),
    minY: Math.min(bottomLeft.y, topRight.y),
    maxX: Math.max(bottomLeft.x, topRight.x),
    maxY: Math.max(bottomLeft.y, topRight.y),
  };
}

function mercatorBBoxesIntersect(a: MercatorBBox, b: MercatorBBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

async function fetchJSON(url: string): Promise<any> {
  if (styleCache.has(url)) {
    return styleCache.get(url);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const data = await response.json();
  styleCache.set(url, data);
  return data;
}

async function resolveBuildingLayerInfo(
  styleUrl: string,
  layerHints: string[]
): Promise<BuildingLayerInfo> {
  const style = await fetchJSON(styleUrl);
  const layers = Array.isArray(style.layers) ? style.layers : [];

  const buildingLayer = layers.find((layer: any) => {
    const sourceLayer = layer["source-layer"];
    if (!layer.source || !sourceLayer || typeof sourceLayer !== "string") {
      return false;
    }
    return layerHints.some((hint) => sourceLayer.includes(hint));
  });

  if (!buildingLayer) {
    throw new Error("Unable to locate a building layer in the provided style.");
  }

  const sourceName: string = buildingLayer.source;
  const source = style.sources?.[sourceName];
  if (!source) {
    throw new Error(`Style source \"${sourceName}\" is not defined.`);
  }

  let tiles: string[] = [];
  let minzoom = source.minzoom;
  let maxzoom = source.maxzoom;

  if (Array.isArray(source.tiles) && source.tiles.length > 0) {
    tiles = source.tiles;
  } else if (typeof source.url === "string") {
    let tileJson = tileJsonCache.get(source.url);
    if (!tileJson) {
      tileJson = await fetchJSON(source.url);
      tileJsonCache.set(source.url, tileJson);
    }
    if (Array.isArray(tileJson.tiles)) {
      tiles = tileJson.tiles;
      minzoom = tileJson.minzoom ?? minzoom;
      maxzoom = tileJson.maxzoom ?? maxzoom;
    }
  }

  if (!tiles.length) {
    throw new Error(
      `Vector tile source for buildings does not expose any tile templates.`
    );
  }

  return {
    sourceLayer: buildingLayer["source-layer"],
    tiles,
    minzoom,
    maxzoom,
  };
}

function renderTileUrl(template: string, coord: TileCoord): string {
  const z = coord.z.toString();
  const x = coord.x.toString();
  const y = coord.y.toString();
  const tmsY = (Math.pow(2, coord.z) - 1 - coord.y).toString();

  let url = template
    .replace(/\{z\}/g, z)
    .replace(/\{x\}/g, x)
    .replace(/\{y\}/g, y)
    .replace(/\{-y\}/g, tmsY)
    .replace(/\{s\}/g, "a");

  url = url.replace(/\{[^}]+\}/g, "");
  return url;
}

async function fetchBuildingsForTile(
  tiles: string[],
  coord: TileCoord,
  layerName: string
): Promise<BuildingFeature[]> {
  const cacheKey = `${layerName}:${coord.z}:${coord.x}:${coord.y}`;
  if (tileFeatureCache.has(cacheKey)) {
    return tileFeatureCache.get(cacheKey) ?? [];
  }

  const errors: Error[] = [];
  for (const template of tiles) {
    const url = renderTileUrl(template, coord);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(
          new Error(`Tile ${url} responded with status ${response.status}`)
        );
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const tile = new VectorTile(new Pbf(arrayBuffer));
      const layer = tile.layers[layerName];
      if (!layer) {
        continue;
      }
      const features: BuildingFeature[] = [];
      for (let i = 0; i < layer.length; i++) {
        const vtFeature = layer.feature(i);
        if (vtFeature.type !== 3) {
          continue;
        }
        const geojson = vtFeature.toGeoJSON(
          coord.x,
          coord.y,
          coord.z
        ) as Feature<Polygon | MultiPolygon>;
        if (!geojson.geometry) {
          continue;
        }

        const flattened = flattenPolygonFeature(geojson);
        flattened.forEach((polygonFeature) => {
          features.push(polygonFeature);
        });
      }

      tileFeatureCache.set(cacheKey, features);
      return features;
    } catch (err) {
      errors.push(err as Error);
    }
  }

  if (errors.length) {
    console.warn("Failed to download building tiles", errors);
  }

  tileFeatureCache.set(cacheKey, []);
  return [];
}

export default class BuildingNavigationModel {
  private readonly zoom: number;
  private readonly cellSize: number;
  private readonly clearance: number;
  private readonly bounds: BBox;
  private readonly boundsMerc: { minX: number; minY: number; maxX: number; maxY: number };
  private readonly grid: GridNode[][];
  private readonly rows: number;
  private readonly cols: number;
  private readonly preparedBuildings: PreparedBuilding[];
  // private enhancedPathfinder: EnhancedPathfinder | null = null;

  static async build(
    options: BuildingNavigationOptions
  ): Promise<BuildingNavigationModel> {
    const zoom = options.zoom ?? DEFAULT_ZOOM_LEVEL;
    const cellSize = options.cellSizeMeters ?? DEFAULT_CELL_SIZE_METERS;
    const layerHints =
      options.buildingLayerHints ?? DEFAULT_BUILDING_LAYER_HINTS;
    const paddingMeters = options.tilePaddingMeters ?? DEFAULT_TILE_PADDING_METERS;
    const clearance = options.clearanceMeters ?? Math.max(6, cellSize / 2);

    const areaCollection = turf.featureCollection(options.areaPolygons);
    const baseBounds = (turf.bbox(areaCollection) as BBox) ?? [
      0,
      0,
      0,
      0,
    ];
    const expandedBounds = expandBBox(baseBounds, paddingMeters);

    const buildingLayerInfo = await resolveBuildingLayerInfo(
      options.styleUrl,
      layerHints
    );

    const tiles = tilesForBBox(expandedBounds, zoom);
    const buildingFeatures: BuildingFeature[] = [];

    for (const tileCoord of tiles) {
      const features = await fetchBuildingsForTile(
        buildingLayerInfo.tiles,
        tileCoord,
        buildingLayerInfo.sourceLayer
      );
      buildingFeatures.push(...features);
    }

    const normalizedBuildings = buildingFeatures.flatMap((feature) => {
      // Buffer each building slightly to avoid pathfinding brushing walls.
      const buffered = turf.buffer(feature, clearance, {
        units: "meters",
      }) as Feature<Polygon | MultiPolygon>;
      return flattenPolygonFeature(buffered);
    });

    return new BuildingNavigationModel(
      expandedBounds,
      normalizedBuildings,
      {
        zoom,
        cellSize,
        clearance,
      }
    );
  }

  private constructor(
    bounds: BBox,
    buildings: BuildingFeature[],
    config: { zoom: number; cellSize: number; clearance: number }
  ) {
    this.zoom = config.zoom;
    this.cellSize = config.cellSize;
    this.bounds = bounds;
    this.clearance = config.clearance;
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const bottomLeft = projectLonLatToMercator(minLon, minLat);
    const topRight = projectLonLatToMercator(maxLon, maxLat);

    this.boundsMerc = {
      minX: Math.min(bottomLeft.x, topRight.x),
      minY: Math.min(bottomLeft.y, topRight.y),
      maxX: Math.max(bottomLeft.x, topRight.x),
      maxY: Math.max(bottomLeft.y, topRight.y),
    };

    this.cols = Math.max(
      2,
      Math.ceil((this.boundsMerc.maxX - this.boundsMerc.minX) / this.cellSize)
    );
    this.rows = Math.max(
      2,
      Math.ceil((this.boundsMerc.maxY - this.boundsMerc.minY) / this.cellSize)
    );

    this.preparedBuildings = buildings.map((feature) => {
      const bbox = turf.bbox(feature) as BBox;
      return {
        feature,
        bbox,
        mercBBox: toMercatorBBox(bbox),
      };
    });

    this.grid = this.buildGrid();
    this.markBuildingsOnGrid();

    // Initialize enhanced pathfinder
    // this.initializeEnhancedPathfinder();
  }

  hasBuildings(): boolean {
    return this.preparedBuildings.length > 0;
  }

  findPath(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    // For now, use CPU pathfinding directly
    // TODO: Re-enable enhanced pathfinder once WebGPU types are properly configured
    return this.findPathCPU(start, goal);
  }

  findPathCPU(
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    if (!this.grid.length || !this.preparedBuildings.length) {
      // No grid or buildings - return empty path to use direct movement with limits
      return [];
    }

    const startNode = this.getClosestWalkableNode(start);
    const goalNode = this.getClosestWalkableNode(goal);

    if (!startNode || !goalNode) {
      // Can't find walkable nodes - return empty path
      return [];
    }

    const pathNodes = this.aStar(startNode, goalNode);
    if (!pathNodes.length) {
      // A* failed - return empty path
      return [];
    }

    // Return simple path with start and goal for debugging
    const rawPath = pathNodes.map((node) => [node.lon, node.lat]) as [
      number,
      number
    ][];

    // Remove start position to prevent backward movement, ensure goal is included
    const path = [...rawPath];
    if (path.length === 0 || (path[path.length - 1][0] !== goal[0] || path[path.length - 1][1] !== goal[1])) {
      path.push(goal);
    }
    return path;
  }

  private buildGrid(): GridNode[][] {
    const grid: GridNode[][] = [];
    for (let row = 0; row < this.rows; row++) {
      const rowNodes: GridNode[] = [];
      for (let col = 0; col < this.cols; col++) {
        const mercX = this.boundsMerc.minX + (col + 0.5) * this.cellSize;
        const mercY = this.boundsMerc.minY + (row + 0.5) * this.cellSize;
        const [lon, lat] = unprojectMercatorToLonLat(mercX, mercY);
        rowNodes.push({
          lon,
          lat,
          merc: { x: mercX, y: mercY },
          walkable: true,
        });
      }
      grid.push(rowNodes);
    }

    return grid;
  }

  private markBuildingsOnGrid(): void {
    if (!this.preparedBuildings.length) {
      return;
    }

    for (const building of this.preparedBuildings) {
      const startCol = Math.max(
        0,
        Math.floor(
          (building.mercBBox.minX - this.boundsMerc.minX) / this.cellSize
        )
      );
      const endCol = Math.min(
        this.cols - 1,
        Math.floor(
          (building.mercBBox.maxX - this.boundsMerc.minX) / this.cellSize
        )
      );

      const startRow = Math.max(
        0,
        Math.floor(
          (building.mercBBox.minY - this.boundsMerc.minY) / this.cellSize
        )
      );
      const endRow = Math.min(
        this.rows - 1,
        Math.floor(
          (building.mercBBox.maxY - this.boundsMerc.minY) / this.cellSize
        )
      );

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const node = this.grid[row][col];
          if (!node.walkable) {
            continue;
          }

          if (this.pointInsideBuilding([node.lon, node.lat], building)) {
            node.walkable = false;
          }
        }
      }
    }
  }

  private pointInsideBuilding(
    coordinate: [number, number],
    building: PreparedBuilding
  ): boolean {
    if (
      !bboxIntersects(building.bbox, [
        coordinate[0],
        coordinate[1],
        coordinate[0],
        coordinate[1],
      ])
    ) {
      return false;
    }

    const point = turf.point(coordinate);
    return turf.booleanPointInPolygon(point, building.feature);
  }

  public isPointWalkable(coordinate: [number, number]): boolean {
    const index = this.toGridIndex(coordinate);
    if (index) {
      const node = this.grid[index.row][index.col];
      if (node.walkable) {
        return true;
      }
    }

    for (const building of this.preparedBuildings) {
      if (this.pointInsideBuilding(coordinate, building)) {
        return false;
      }
    }

    return true;
  }

  private toGridIndex(coord: [number, number]): GridIndex | null {
    const merc = projectLonLatToMercator(coord[0], coord[1]);
    const colFloat = (merc.x - this.boundsMerc.minX) / this.cellSize;
    const rowFloat = (merc.y - this.boundsMerc.minY) / this.cellSize;

    if (colFloat < 0 || rowFloat < 0 || colFloat >= this.cols || rowFloat >= this.rows) {
      return null;
    }

    const col = Math.max(0, Math.min(this.cols - 1, Math.floor(colFloat)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(rowFloat)));
    return { row, col };
  }

  private getClosestWalkableNode(
    coord: [number, number]
  ): GridNode | null {
    const index = this.toGridIndex(coord);
    if (!index) {
      return null;
    }

    const directNode = this.grid[index.row][index.col];
    if (directNode.walkable) {
      return directNode;
    }

    const visited = new Set<string>();
    const queue: GridIndex[] = [index];

    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const key = `${current.row}:${current.col}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      if (!this.inBounds(current.row, current.col)) {
        continue;
      }

      const node = this.grid[current.row][current.col];
      if (node.walkable) {
        return node;
      }

      this.getNeighborIndices(current.row, current.col, false).forEach(
        (neighbor) => {
          if (!visited.has(`${neighbor.row}:${neighbor.col}`)) {
            queue.push(neighbor);
          }
        }
      );
    }

    return null;
  }

  private inBounds(row: number, col: number): boolean {
    return row >= 0 && col >= 0 && row < this.rows && col < this.cols;
  }

  private getNeighborIndices(
    row: number,
    col: number,
    includeDiagonals = true
  ): GridIndex[] {
    const neighbors: GridIndex[] = [];
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    const diagonals = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    directions.forEach(([dRow, dCol]) => {
      const nRow = row + dRow;
      const nCol = col + dCol;
      if (this.inBounds(nRow, nCol)) {
        neighbors.push({ row: nRow, col: nCol });
      }
    });

    if (includeDiagonals) {
      diagonals.forEach(([dRow, dCol]) => {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (!this.inBounds(nRow, nCol)) {
          return;
        }
        const horizontal = this.grid[row][nCol];
        const vertical = this.grid[nRow][col];
        if (!horizontal.walkable || !vertical.walkable) {
          return;
        }
        neighbors.push({ row: nRow, col: nCol });
      });
    }

    return neighbors;
  }

  private aStar(start: GridNode, goal: GridNode): GridNode[] {
    const startIndex = this.toGridIndex([start.lon, start.lat]);
    const goalIndex = this.toGridIndex([goal.lon, goal.lat]);

    if (!startIndex || !goalIndex) {
      return [];
    }

    const openSet = new PriorityQueue<GridIndex>();
    const startKey = `${startIndex.row}:${startIndex.col}`;
    openSet.enqueue(startIndex, 0);

    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startKey, 0]]);
    const fScore = new Map<string, number>([[
      startKey,
      this.heuristic(start, goal),
    ]]);
    const closedSet = new Set<string>();

    while (!openSet.isEmpty()) {
      const currentIndex = openSet.dequeue();
      if (!currentIndex) {
        break;
      }

      if (currentIndex.row === goalIndex.row && currentIndex.col === goalIndex.col) {
        return this.reconstructPath(cameFrom, currentIndex);
      }

      const currentKey = `${currentIndex.row}:${currentIndex.col}`;
      if (closedSet.has(currentKey)) {
        continue;
      }
      closedSet.add(currentKey);

      const currentNode = this.grid[currentIndex.row][currentIndex.col];

      this.getNeighborIndices(currentIndex.row, currentIndex.col).forEach(
        (neighborIndex) => {
          const neighborNode = this.grid[neighborIndex.row][neighborIndex.col];
          if (!neighborNode.walkable) {
            return;
          }

          const tentativeGScore =
            (gScore.get(currentKey) ?? Infinity) +
            distanceOnMercator(currentNode.merc, neighborNode.merc);

          const neighborKey = `${neighborIndex.row}:${neighborIndex.col}`;
          if (closedSet.has(neighborKey)) {
            return;
          }

          if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
            cameFrom.set(neighborKey, currentKey);
            gScore.set(neighborKey, tentativeGScore);
            const f = tentativeGScore + this.heuristic(neighborNode, goal);
            fScore.set(neighborKey, f);
            openSet.enqueue(neighborIndex, f);
          }
        }
      );
    }

    return [];
  }

  private reconstructPath(
    cameFrom: Map<string, string>,
    current: GridIndex
  ): GridNode[] {
    const path: GridNode[] = [];
    let cursor: GridIndex | undefined = current;

    while (cursor) {
      path.push(this.grid[cursor.row][cursor.col]);
      const key = `${cursor.row}:${cursor.col}`;
      const parentKey = cameFrom.get(key);
      if (!parentKey) {
        break;
      }
      const [pRow, pCol] = parentKey.split(":").map(Number);
      cursor = { row: pRow, col: pCol };
    }

    return path.reverse();
  }

  private heuristic(node: GridNode, goal: GridNode): number {
    return distanceOnMercator(node.merc, goal.merc);
  }

  private smoothPath(
    nodes: [number, number][],
    start: [number, number],
    goal: [number, number]
  ): [number, number][] {
    const path = [start, ...nodes, goal];
    if (path.length <= 2) {
      return path;
    }

    if (!this.segmentBlocked(start, goal)) {
      return [start, goal];
    }

    const smoothed: [number, number][] = [start];
    let anchorIndex = 0;

    for (let i = 2; i < path.length; i++) {
      const anchor = path[anchorIndex];
      const candidate = path[i];
      if (this.segmentBlocked(anchor, candidate)) {
        const previous = path[i - 1];
        smoothed.push(previous);
        anchorIndex = i - 1;
      }
    }

    const last = smoothed[smoothed.length - 1];
    if (last[0] !== goal[0] || last[1] !== goal[1]) {
      smoothed.push(goal);
    }

    return smoothed;
  }

  private segmentBlocked(
    start: [number, number],
    end: [number, number]
  ): boolean {
    const startIndex = this.toGridIndex(start);
    const endIndex = this.toGridIndex(end);

    if (startIndex && endIndex) {
      if (this.segmentBlockedRasterized(start, end)) {
        return true;
      }
    }

    return this.segmentBlockedPrecise(start, end);
  }

  private segmentBlockedRasterized(
    start: [number, number],
    end: [number, number]
  ): boolean {
    const startMerc = projectLonLatToMercator(start[0], start[1]);
    const endMerc = projectLonLatToMercator(end[0], end[1]);
    const dx = endMerc.x - startMerc.x;
    const dy = endMerc.y - startMerc.y;
    const maxDimension = Math.max(Math.abs(dx), Math.abs(dy));

    if (maxDimension === 0) {
      const index = this.toGridIndex(start);
      if (!index) {
        return false;
      }
      return !this.grid[index.row][index.col].walkable;
    }

    const stepSize = this.cellSize * 0.5;
    const steps = Math.max(1, Math.ceil(maxDimension / stepSize));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startMerc.x + dx * t;
      const y = startMerc.y + dy * t;
      const col = Math.floor((x - this.boundsMerc.minX) / this.cellSize);
      const row = Math.floor((y - this.boundsMerc.minY) / this.cellSize);

      if (!this.inBounds(row, col)) {
        continue;
      }

      if (!this.grid[row][col].walkable) {
        return true;
      }
    }

    return false;
  }

  private segmentBlockedPrecise(
    start: [number, number],
    end: [number, number]
  ): boolean {
    const lineBbox: BBox = [
      Math.min(start[0], end[0]),
      Math.min(start[1], end[1]),
      Math.max(start[0], end[0]),
      Math.max(start[1], end[1]),
    ];
    const lineMercBBox = toMercatorBBox(lineBbox);

    const line = turf.lineString([start, end]);
    for (const building of this.preparedBuildings) {
      if (
        !mercatorBBoxesIntersect(
          building.mercBBox,
          lineMercBBox
        )
      ) {
        continue;
      }

      if (!bboxIntersects(lineBbox, building.bbox)) {
        continue;
      }
      if (!turf.booleanDisjoint(line, building.feature)) {
        return true;
      }
    }
    return false;
  }

  // private initializeEnhancedPathfinder(): void {
  //   try {
  //     this.enhancedPathfinder = new EnhancedPathfinder();
  //     this.enhancedPathfinder.updateNavigationModel(this);
  //     console.log('Enhanced pathfinder initialized');
  //   } catch (error) {
  //     console.warn('Failed to initialize enhanced pathfinder:', error);
  //     this.enhancedPathfinder = null;
  //   }
  // }

  // public getPathfindingStats() {
  //   if (!this.enhancedPathfinder) {
  //     return null;
  //   }
  //   return this.enhancedPathfinder.getStats();
  // }

  public destroy(): void {
    // if (this.enhancedPathfinder) {
    //   this.enhancedPathfinder.destroy();
    //   this.enhancedPathfinder = null;
    // }
  }
}
