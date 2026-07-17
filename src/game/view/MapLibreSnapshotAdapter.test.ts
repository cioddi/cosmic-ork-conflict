import { GameSnapshot, MovementTrace } from "../classes/Game";
import { MiniatureType } from "../classes/Miniature";
import { LocalProjection } from "../world";
import {
  gameSnapshotToRenderedGeoJSON,
  sampleMovementTrace,
} from "./MapLibreSnapshotAdapter";

const trace: MovementTrace = {
  unitId: "unit",
  points: [[0, 0], [10, 0], [10, 30]],
  segmentLengths: [10, 30],
  totalDistance: 40,
  startedAtTick: 1,
};

test("samples a multi-segment movement trace by distance, not endpoint chord", () => {
  expect(sampleMovementTrace(trace, 0).position).toEqual([0, 0]);
  expect(sampleMovementTrace(trace, 0.25).position).toEqual([10, 0]);
  expect(sampleMovementTrace(trace, 0.5).position).toEqual([10, 10]);
  expect(sampleMovementTrace(trace, 1).position).toEqual([10, 30]);
});

test("clamps trace samples and reports segment bearing", () => {
  expect(sampleMovementTrace(trace, -1).position).toEqual([0, 0]);
  expect(sampleMovementTrace(trace, 2).position).toEqual([10, 30]);
  expect(sampleMovementTrace(trace, 0.5).bearing).toBeCloseTo(0, 8);
});

test("creates a minimal animation payload without gameplay-only properties", () => {
  const snapshot: GameSnapshot = {
    tick: 0,
    movementTraces: [],
    units: [
      {
        playerId: 1,
        position: [0, 0],
        properties: {
          id: "unit",
          name: "Unit",
          image: "assets/biker_1.png",
          description: "Large property that the renderer does not need",
          type: MiniatureType.VEHICLE,
          size: { x: 1, y: 1, z: 1 },
          bearing: 0,
          speed: 5,
          meleeAttack: 1,
          rangeAttack: 1,
          armour: 1,
          hitpoints: 10,
          weapons: [{ name: "weapon", description: "", damage: 1, range: 1 }],
          damageDealt: 0,
          killCount: 0,
          unitsKilled: [],
        },
      },
    ],
  };

  const properties = gameSnapshotToRenderedGeoJSON(
    snapshot,
    new LocalProjection([0, 0])
  ).features[0].properties;

  expect(properties).toEqual({
    id: "unit",
    name: "Unit",
    type: MiniatureType.VEHICLE,
    iconId: "unit-orc-biker",
    size: { x: 1, y: 1, z: 1 },
    hitpoints: 10,
    killCount: 0,
    bearing: 0,
    playerId: 1,
  });
  expect(properties).not.toHaveProperty("description");
  expect(properties).not.toHaveProperty("weapons");
});
