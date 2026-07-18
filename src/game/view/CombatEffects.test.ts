import { CombatTrace } from "../classes/Game";
import { LocalProjection } from "../world";
import { combatTracesToGeoJSON } from "./CombatEffects";

const projection = new LocalProjection([0, 0]);

function trace(overrides: Partial<CombatTrace> = {}): CombatTrace {
  return {
    id: "combat-1",
    attackerId: "attacker",
    targetId: "target",
    kind: "ranged",
    start: [0, 0],
    end: [10, 0],
    hit: true,
    damage: 5,
    startedAtTick: 1,
    ...overrides,
  };
}

test("animates a ranged projectile and reveals its hit burst on impact", () => {
  const early = combatTracesToGeoJSON([trace()], projection, 0.25);
  const impact = combatTracesToGeoJSON([trace()], projection, 0.8);

  expect(early.features.map((feature) => feature.properties.effect)).toEqual([
    "ranged-tracer",
    "projectile",
  ]);
  expect(impact.features.map((feature) => feature.properties.effect)).toEqual([
    "ranged-tracer",
    "projectile",
    "hit",
  ]);
  expect(early.features[1].geometry).not.toEqual(impact.features[1].geometry);
});

test("renders close combat as a slash and does not show a burst for a miss", () => {
  const effects = combatTracesToGeoJSON(
    [trace({ kind: "melee", hit: false, damage: 0 })],
    projection,
    1
  );

  expect(effects.features).toHaveLength(1);
  expect(effects.features[0].properties.effect).toBe("melee-slash");
  expect(effects.features[0].geometry.type).toBe("LineString");
});
