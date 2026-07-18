import { MiniatureType } from "../classes/Miniature";
import { MiniatureGeoJsonFeature } from "./MapLibreSnapshotAdapter";
import { summarizeBattle } from "./EndGameOverlay";

function unit(
  name: string,
  playerId: number,
  killCount: number,
  damageDealt: number,
  hitpoints: number
): MiniatureGeoJsonFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: {
      id: name,
      name,
      description: "fixture",
      type: MiniatureType.INFANTRY,
      size: { x: 1, y: 1, z: 1 },
      bearing: 0,
      speed: 5,
      meleeAttack: 3,
      rangeAttack: 4,
      armour: 1,
      hitpoints,
      initialHitpoints: 10,
      weapons: [],
      damageDealt,
      killCount,
      unitsKilled: [],
      playerId,
    },
  };
}

test("summarizes the battle and ranks best and worst performers", () => {
  const summary = summarizeBattle(
    [
      unit("Da Star", 1, 3, 22, 4),
      unit("Average Git", 2, 1, 8, 2),
      unit("Unlucky Git", 2, 0, 1, 0),
    ],
    [
      { id: 1, name: "Iron Mob" },
      { id: 2, name: "Rust Raiders" },
    ],
    17,
    1
  );

  expect(summary).toMatchObject({
    winnerName: "Iron Mob",
    rounds: 17,
    totalDamage: 31,
    totalKills: 4,
    survivors: 2,
    casualties: 1,
  });
  expect(summary.best?.unit.properties.name).toBe("Da Star");
  expect(summary.best?.playerName).toBe("Iron Mob");
  expect(summary.worst?.unit.properties.name).toBe("Unlucky Git");
  expect(summary.worst?.playerName).toBe("Rust Raiders");
});
