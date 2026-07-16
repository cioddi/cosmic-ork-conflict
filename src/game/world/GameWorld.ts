import { LocalProjection } from "./LocalProjection";
import {
  boundsIntersect,
  distancePointToPolygon,
  expandBounds,
  pointInBounds,
  pointInPolygon,
  segmentIntersectsPolygon,
} from "./geometry";
import {
  MobilityProfile,
  WorldBounds,
  WorldDefinition,
  WorldPoint,
  WorldPolygon,
} from "./types";

export interface GameWorldOptions {
  definition: WorldDefinition;
  projection: LocalProjection;
  routingBounds: WorldBounds;
  playableArea: WorldPolygon;
  setupAreas: readonly WorldPolygon[];
  obstacles: readonly WorldPolygon[];
}

/** Immutable static terrain and collision model shared by every game tick. */
export class GameWorld {
  public readonly definition: WorldDefinition;
  public readonly projection: LocalProjection;
  public readonly routingBounds: WorldBounds;
  public readonly playableArea: WorldPolygon;
  public readonly setupAreas: readonly WorldPolygon[];
  public readonly obstacles: readonly WorldPolygon[];

  private readonly profiles = new Map<string, MobilityProfile>();
  private readonly obstacleById = new Map<string, WorldPolygon>();
  private readonly spatialIndex = new Map<string, string[]>();
  private readonly indexCellSize: number;
  private readonly maxClearance: number;

  constructor(options: GameWorldOptions) {
    this.definition = options.definition;
    this.projection = options.projection;
    this.routingBounds = options.routingBounds;
    this.playableArea = options.playableArea;
    this.setupAreas = Object.freeze([...options.setupAreas]);
    this.obstacles = Object.freeze([...options.obstacles]);
    this.indexCellSize = options.definition.spatialIndexCellSizeMeters;
    this.maxClearance = Math.max(
      0,
      ...options.definition.mobilityProfiles.map((profile) => profile.clearanceMeters)
    );

    for (const profile of options.definition.mobilityProfiles) {
      this.profiles.set(profile.id, profile);
    }
    for (const obstacle of this.obstacles) {
      this.obstacleById.set(obstacle.id, obstacle);
      this.indexObstacle(obstacle);
    }
  }

  get versionKey(): string {
    return `${this.definition.id}@${this.definition.version}`;
  }

  getMobilityProfile(id: string): MobilityProfile {
    const profile = this.profiles.get(id);
    if (!profile) throw new Error(`Unknown mobility profile: ${id}`);
    return profile;
  }

  canOccupy(point: WorldPoint, mobilityProfileId: string): boolean {
    const clearance = this.getMobilityProfile(mobilityProfileId).clearanceMeters;
    return this.canOccupyWithClearance(point, clearance);
  }

  canOccupyWithClearance(point: WorldPoint, clearance: number): boolean {
    if (!pointInBounds(point, expandBounds(this.routingBounds, -clearance))) {
      return false;
    }
    const query: WorldBounds = {
      minX: point[0] - clearance,
      minY: point[1] - clearance,
      maxX: point[0] + clearance,
      maxY: point[1] + clearance,
    };
    return this.candidates(query).every(
      (obstacle) => distancePointToPolygon(point, obstacle) > clearance
    );
  }

  canTraverse(
    from: WorldPoint,
    to: WorldPoint,
    mobilityProfileId: string
  ): boolean {
    const clearance = this.getMobilityProfile(mobilityProfileId).clearanceMeters;
    return this.canTraverseWithClearance(from, to, clearance);
  }

  canTraverseWithClearance(
    from: WorldPoint,
    to: WorldPoint,
    clearance: number
  ): boolean {
    if (
      !this.canOccupyWithClearance(from, clearance) ||
      !this.canOccupyWithClearance(to, clearance)
    ) {
      return false;
    }
    const query: WorldBounds = {
      minX: Math.min(from[0], to[0]) - clearance,
      minY: Math.min(from[1], to[1]) - clearance,
      maxX: Math.max(from[0], to[0]) + clearance,
      maxY: Math.max(from[1], to[1]) + clearance,
    };
    return this.candidates(query).every(
      (obstacle) => !segmentIntersectsPolygon(from, to, obstacle, clearance)
    );
  }

  isInsideSetupArea(point: WorldPoint, playerIndex: number): boolean {
    const area = this.setupAreas[playerIndex];
    return Boolean(area && pointInPolygon(point, area));
  }

  private indexObstacle(obstacle: WorldPolygon): void {
    const bounds = expandBounds(obstacle.bounds, this.maxClearance);
    for (const key of this.cellKeys(bounds)) {
      const existing = this.spatialIndex.get(key);
      if (existing) existing.push(obstacle.id);
      else this.spatialIndex.set(key, [obstacle.id]);
    }
  }

  private candidates(bounds: WorldBounds): WorldPolygon[] {
    const ids = new Set<string>();
    for (const key of this.cellKeys(bounds)) {
      for (const id of this.spatialIndex.get(key) ?? []) ids.add(id);
    }
    const result: WorldPolygon[] = [];
    for (const id of Array.from(ids)) {
      const obstacle = this.obstacleById.get(id);
      if (obstacle && boundsIntersect(expandBounds(obstacle.bounds, this.maxClearance), bounds)) {
        result.push(obstacle);
      }
    }
    return result;
  }

  private cellKeys(bounds: WorldBounds): string[] {
    const minX = Math.floor(bounds.minX / this.indexCellSize);
    const maxX = Math.floor(bounds.maxX / this.indexCellSize);
    const minY = Math.floor(bounds.minY / this.indexCellSize);
    const maxY = Math.floor(bounds.maxY / this.indexCellSize);
    const keys: string[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) keys.push(`${x}:${y}`);
    }
    return keys;
  }
}
