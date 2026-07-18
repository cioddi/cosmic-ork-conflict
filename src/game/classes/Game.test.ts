import Game from "./Game";
import Miniature, { MiniatureParams, MiniatureType } from "./Miniature";
import SequentialAI from "./SequentialAI";
import { GameWorld, LocalProjection, WorldDefinition, WorldPoint, WorldPolygon, worldBoundsForPoints } from "../world";
import { GridNavigation } from "../navigation/GridNavigation";
import { vi } from "vitest";

function polygon(id: string, points: WorldPoint[]): WorldPolygon {
  return { id, outer: points, holes: [], bounds: worldBoundsForPoints(points) };
}

function fixtureWorld(): GameWorld {
  const area = {
    outer: [
      [-0.001, -0.001],
      [0.001, -0.001],
      [0.001, 0.001],
      [-0.001, 0.001],
    ],
  } as const;
  const definition: WorldDefinition = {
    id: "engine-fixture",
    version: "1",
    playableArea: area,
    setupAreas: [area, area],
    routingPaddingMeters: 0,
    navigationCellSizeMeters: 4,
    spatialIndexCellSizeMeters: 20,
    mobilityProfiles: [{ id: "infantry", clearanceMeters: 1 }],
    tileSource: { urlTemplate: "fixture", sourceLayer: "building", zoom: 1 },
  };
  const playable = polygon("playable", [
    [-50, -50], [50, -50], [50, 50], [-50, 50],
  ]);
  return new GameWorld({
    definition,
    projection: new LocalProjection([0, 0]),
    routingBounds: playable.bounds,
    playableArea: playable,
    setupAreas: [playable, playable],
    obstacles: [polygon("building", [[-5, -20], [5, -20], [5, 20], [-5, 20]])],
  });
}

function isolatedCourtyardWorld(): GameWorld {
  const base = fixtureWorld();
  const courtyard: WorldPolygon = {
    id: "sealed-courtyard",
    outer: [[-15, -15], [15, -15], [15, 15], [-15, 15]],
    holes: [[[-5, -5], [5, -5], [5, 5], [-5, 5]]],
    bounds: { minX: -15, minY: -15, maxX: 15, maxY: 15 },
  };
  return new GameWorld({
    definition: base.definition,
    projection: base.projection,
    routingBounds: base.routingBounds,
    playableArea: base.playableArea,
    setupAreas: [base.playableArea, base.playableArea],
    obstacles: [courtyard],
  });
}

function miniature(name: string, position: WorldPoint): Miniature {
  const options: MiniatureParams = {
    name,
    description: name,
    type: MiniatureType.INFANTRY,
    size: { x: 1, y: 1, z: 1 },
    position,
    bearing: 0,
    speed: 12,
    meleeAttack: 1,
    rangeAttack: 1,
    armour: 1,
    hitpoints: 10,
    weapons: [{ name: "choppa", description: "", damage: 1, range: 1 }],
  };
  return new Miniature(options);
}

test("Game commits only a collision-safe prefix and emits its exact trace", () => {
  const world = fixtureWorld();
  const mover = miniature("mover", [-30, 0]);
  const target = miniature("target", [30, 0]);
  const player1 = new SequentialAI(1, "one", [mover], "red");
  const player2 = new SequentialAI(2, "two", [target], "yellow");
  const game = new Game([player1, player2], world, new GridNavigation(world), () => 0.5);

  game.beginStep();
  const result = game.navigateMiniature(player1, mover, target.state.position, 35);
  expect(result.status).toBe("moved");
  if (result.status !== "moved") return;
  expect(result.trace.totalDistance).toBeCloseTo(35, 6);
  for (let index = 1; index < result.trace.points.length; index++) {
    expect(world.canTraverse(
      result.trace.points[index - 1],
      result.trace.points[index],
      "infantry"
    )).toBe(true);
  }
  expect(world.canOccupy(mover.state.position, "infantry")).toBe(true);
  expect(game.getSnapshot().movementTraces).toHaveLength(1);
});

test("AI uses the configured larger movement budget per round", () => {
  const world = fixtureWorld();
  const mover = miniature("mover", [-40, 30]);
  const target = miniature("target", [-20, 30]);
  const player1 = new SequentialAI(1, "one", [mover], "red");
  const player2 = new SequentialAI(2, "two", [target], "yellow");
  const navigation = new GridNavigation(world);
  const findPath = vi.spyOn(navigation, "findPath");
  const game = new Game([player1, player2], world, navigation, () => 0.5);

  game.beginStep();
  player1.playRound(game);

  expect(game.getDistanceAndBearing(mover, target).distance).toBeCloseTo(
    game.rules.closeCombatRangeMeters,
    6
  );
  expect(game.getSnapshot().movementTraces[0].totalDistance).toBeCloseTo(18, 6);
  expect(findPath).toHaveBeenCalledTimes(1);
});

test("a ranged unit attacks and holds its firing distance", () => {
  const world = fixtureWorld();
  const mover = miniature("ranged mover", [-30, 30]);
  mover.state.weapons = [{ name: "shoota", description: "", damage: 1, range: 15 }];
  const target = miniature("last enemy", [-20, 30]);
  const startingHitpoints = target.state.hitpoints;
  const player1 = new SequentialAI(1, "one", [mover], "red");
  const player2 = new SequentialAI(2, "two", [target], "yellow");
  const game = new Game([player1, player2], world, new GridNavigation(world), () => 0.5);

  game.beginStep();
  player1.playRound(game);

  expect(target.state.hitpoints).toBeLessThan(startingHitpoints);
  expect(game.getDistanceAndBearing(mover, target).distance).toBeCloseTo(10, 6);
  expect(game.getSnapshot().movementTraces).toHaveLength(0);
  expect(game.getSnapshot().combatTraces).toMatchObject([
    { kind: "ranged", hit: true },
  ]);
});

test("ranged units advance to firing distance, shoot, and use weapon damage", () => {
  const world = fixtureWorld();
  const shooter = miniature("shooter", [-40, 30]);
  shooter.state.weapons = [
    { name: "heavy shoota", description: "", damage: 5, range: 12 },
  ];
  shooter.state.rangeAttack = 3;
  const target = miniature("target", [-20, 30]);
  target.state.armour = 2;
  const player1 = new SequentialAI(1, "one", [shooter], "red");
  const player2 = new SequentialAI(2, "two", [target], "yellow");
  const game = new Game(
    [player1, player2],
    world,
    new GridNavigation(world),
    () => 0.5
  );

  game.beginStep();
  player1.playRound(game);

  expect(game.getDistanceAndBearing(shooter, target).distance).toBeCloseTo(12, 6);
  expect(target.state.hitpoints).toBe(3); // roll 4 + weapon 5 - armour 2
  expect(game.getSnapshot().combatTraces[0]).toMatchObject({
    kind: "ranged",
    hit: true,
    damage: 7,
  });
});

test("an isolated unit makes a safe local move every round without relocation", () => {
  const world = isolatedCourtyardWorld();
  const isolated = miniature("isolated", [0, 0]);
  const target = miniature("target", [30, 0]);
  const player1 = new SequentialAI(1, "one", [isolated], "red");
  const player2 = new SequentialAI(2, "two", [target], "yellow");
  const game = new Game([player1, player2], world, new GridNavigation(world));

  for (let round = 0; round < 6; round++) {
    const previous: WorldPoint = [...isolated.state.position];
    game.beginStep();
    player1.playRound(game);
    const trace = game.getSnapshot().movementTraces.find(
      (candidate) => candidate.unitId === isolated.state.id
    );

    expect(trace).toBeDefined();
    expect(trace!.totalDistance).toBeGreaterThan(0.001);
    expect(isolated.state.position).not.toEqual(previous);
    expect(Math.abs(isolated.state.position[0])).toBeLessThan(5);
    expect(Math.abs(isolated.state.position[1])).toBeLessThan(5);
    for (let index = 1; index < trace!.points.length; index++) {
      expect(
        world.canTraverse(
          trace!.points[index - 1],
          trace!.points[index],
          "infantry"
        )
      ).toBe(true);
    }
  }
});
