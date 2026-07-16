import { GridNavigation } from "../navigation/GridNavigation";
import { GameWorld } from "./GameWorld";
import { LocalProjection } from "./LocalProjection";
import { findSpawnPoint, createSeededRandom } from "./SpawnService";
import { WorldDefinition, WorldPoint, WorldPolygon } from "./types";
import { worldBoundsForPoints } from "./geometry";

const definition: WorldDefinition = {
  id: "fixture",
  version: "1",
  playableArea: {
    outer: [
      [-0.001, -0.001],
      [0.001, -0.001],
      [0.001, 0.001],
      [-0.001, 0.001],
    ],
  },
  setupAreas: [],
  routingPaddingMeters: 0,
  navigationCellSizeMeters: 4,
  spatialIndexCellSizeMeters: 20,
  mobilityProfiles: [
    { id: "infantry", clearanceMeters: 1 },
    { id: "vehicle", clearanceMeters: 2 },
  ],
  tileSource: { urlTemplate: "fixture", sourceLayer: "building", zoom: 14 },
};

function polygon(id: string, points: WorldPoint[]): WorldPolygon {
  return { id, outer: points, holes: [], bounds: worldBoundsForPoints(points) };
}

function createWorld(): GameWorld {
  const projection = new LocalProjection([0, 0]);
  const playable = polygon("playable", [
    [-50, -50],
    [50, -50],
    [50, 50],
    [-50, 50],
  ]);
  const setup = polygon("setup", [
    [-45, -45],
    [-20, -45],
    [-20, 45],
    [-45, 45],
  ]);
  return new GameWorld({
    definition: { ...definition, setupAreas: [definition.playableArea] },
    projection,
    routingBounds: playable.bounds,
    playableArea: playable,
    setupAreas: [setup],
    obstacles: [
      polygon("building", [
        [-5, -20],
        [5, -20],
        [5, 20],
        [-5, 20],
      ]),
    ],
  });
}

describe("GameWorld collision invariant", () => {
  test("blocks occupancy inside and within mobility clearance", () => {
    const world = createWorld();
    expect(world.canOccupy([0, 0], "infantry")).toBe(false);
    expect(world.canOccupy([5.5, 0], "infantry")).toBe(false);
    expect(world.canOccupy([6.1, 0], "infantry")).toBe(true);
    expect(world.canOccupy([6.1, 0], "vehicle")).toBe(false);
  });

  test("blocks every segment crossing or touching a building", () => {
    const world = createWorld();
    expect(world.canTraverse([-30, 0], [30, 0], "infantry")).toBe(false);
    expect(world.canTraverse([-30, 21], [30, 21], "infantry")).toBe(false);
    expect(world.canTraverse([-30, 22], [30, 22], "infantry")).toBe(true);
  });

  test("finds a path whose every segment passes exact collision validation", () => {
    const world = createWorld();
    const navigation = new GridNavigation(world);
    const path = navigation.findPath([-30, 0], [30, 0], "infantry");
    expect(path.length).toBeGreaterThan(2);
    for (let index = 1; index < path.length; index++) {
      expect(world.canTraverse(path[index - 1], path[index], "infantry")).toBe(true);
    }
    expect(path.some((point) => Math.abs(point[1]) > 20)).toBe(true);
  });

  test("routes to a safe approach point when the exact target lacks clearance", () => {
    const world = createWorld();
    const navigation = new GridNavigation(world);
    const start: WorldPoint = [30, 0];
    const target: WorldPoint = [6.1, 0];

    expect(world.canOccupy(target, "infantry")).toBe(true);
    expect(world.canOccupy(target, "vehicle")).toBe(false);
    const path = navigation.findPath(start, target, "vehicle");

    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).not.toEqual(target);
    expect(
      Math.hypot(
        path[path.length - 1][0] - target[0],
        path[path.length - 1][1] - target[1]
      )
    ).toBeLessThan(Math.hypot(start[0] - target[0], start[1] - target[1]));
    for (let index = 1; index < path.length; index++) {
      expect(world.canTraverse(path[index - 1], path[index], "vehicle")).toBe(true);
    }
  });

  test("spawns deterministically inside the setup area and outside obstacles", () => {
    const world = createWorld();
    const first = findSpawnPoint(world, 0, "infantry", createSeededRandom(42));
    const second = findSpawnPoint(world, 0, "infantry", createSeededRandom(42));
    expect(first).toEqual(second);
    expect(world.isInsideSetupArea(first, 0)).toBe(true);
    expect(world.canOccupy(first, "infantry")).toBe(true);
  });

  test("distinguishes the main navigation area from an isolated courtyard", () => {
    const base = createWorld();
    const courtyardBuilding: WorldPolygon = {
      id: "courtyard-building",
      outer: [[-15, -15], [15, -15], [15, 15], [-15, 15]],
      holes: [[[-5, -5], [5, -5], [5, 5], [-5, 5]]],
      bounds: { minX: -15, minY: -15, maxX: 15, maxY: 15 },
    };
    const world = new GameWorld({
      definition: base.definition,
      projection: base.projection,
      routingBounds: base.routingBounds,
      playableArea: base.playableArea,
      setupAreas: base.setupAreas,
      obstacles: [courtyardBuilding],
    });
    const navigation = new GridNavigation(world);
    expect(world.canOccupy([0, 0], "infantry")).toBe(true);
    expect(navigation.isInMainNavigableArea([0, 0], "infantry")).toBe(false);
    expect(navigation.isInMainNavigableArea([-30, 0], "infantry")).toBe(true);
  });
});

describe("LocalProjection", () => {
  test("round trips geographic coordinates", () => {
    const projection = new LocalProjection([2.32, 48.84]);
    const geographic = [2.331, 48.851] as const;
    const roundTrip = projection.unproject(projection.project(geographic));
    expect(roundTrip[0]).toBeCloseTo(geographic[0], 10);
    expect(roundTrip[1]).toBeCloseTo(geographic[1], 10);
  });
});
