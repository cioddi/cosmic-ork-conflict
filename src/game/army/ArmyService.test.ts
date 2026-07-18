import {
  ARMY_STORAGE_KEY,
  createArmy,
  generateRandomArmy,
  getArmyPointCost,
  getArmyUnitCount,
  isUsableArmy,
  loadArmyCollection,
  saveArmyCollection,
  setArmyUnitCount,
} from "./ArmyService";
import { UNIT_CATALOG, UNIT_CATALOG_BY_ID, calculateUnitPointCost } from "./catalog";
import { MiniatureType } from "../classes/Miniature";

test("point costs are deterministic and constrained armies reject overspending", () => {
  const entry = UNIT_CATALOG[0];
  expect(calculateUnitPointCost(entry.template)).toBe(entry.points);
  const base = { ...createArmy("Budget", new Date(0), "budget"), pointLimit: entry.points };
  const one = setArmyUnitCount(base, entry.id, 1, new Date(1));
  const rejected = setArmyUnitCount(one, entry.id, 2, new Date(2));
  expect(getArmyUnitCount(one)).toBe(1);
  expect(rejected).toEqual(one);
});

test("saved armies round trip and malformed storage fails closed", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const army = setArmyUnitCount(
    createArmy("Stored", new Date(0), "stored"),
    UNIT_CATALOG[0].id,
    2,
    new Date(1)
  );
  saveArmyCollection(storage, [army]);
  expect(loadArmyCollection(storage)).toEqual([army]);
  values.set(ARMY_STORAGE_KEY, "{bad json");
  expect(loadArmyCollection(storage)).toEqual([]);
});

test("random opponents stay near the requested point cost", () => {
  const army = generateRandomArmy(500, () => 0.42);
  expect(getArmyUnitCount(army)).toBeGreaterThan(0);
  expect(Math.abs(getArmyPointCost(army) - 500)).toBeLessThanOrEqual(40);
});

test("invalid counts and unknown catalogue entries cannot enter a battle", () => {
  const base = createArmy("Validated", new Date(0), "validated");
  expect(setArmyUnitCount(base, UNIT_CATALOG[0].id, Number.NaN)).toBe(base);
  expect(isUsableArmy({ ...base, unitCounts: { unknown: 1 } })).toBe(false);
  const unknownStoredArmy = JSON.stringify({
    version: 1,
    armies: [{ ...base, unitCounts: { unknown: 1 } }],
  });
  expect(
    loadArmyCollection({
      getItem: () => unknownStoredArmy,
      setItem: () => undefined,
    })
  ).toEqual([]);
  expect(
    loadArmyCollection({
      getItem: () =>
        JSON.stringify({
          version: 1,
          armies: [{ ...base, pointLimit: Number.POSITIVE_INFINITY }],
        }),
      setItem: () => undefined,
    })
  ).toEqual([]);
});

test("the expanded roster preserves the intended balance anchors", () => {
  const goblins = UNIT_CATALOG_BY_ID.get("goblin-snikkitz")!;
  const biker = UNIT_CATALOG_BY_ID.get("orc-biker")!;
  const orkBoy = UNIT_CATALOG_BY_ID.get("ork-boy")!;
  const characters = UNIT_CATALOG.filter(
    (entry) => entry.template.type === MiniatureType.CHARACTER
  );

  expect(UNIT_CATALOG).toHaveLength(12);
  expect(goblins.template.name).toBe("Scrapling Rabble");
  expect(goblins.points).toBeLessThan(orkBoy.points);
  expect(goblins.points).toBeLessThanOrEqual(40);
  expect(biker.template.hitpoints).toBe(7);
  expect(characters.every((entry) => entry.template.hitpoints >= 20)).toBe(true);
  expect(characters.every((entry) => entry.points > orkBoy.points)).toBe(true);
  expect(characters.every((entry) => entry.maxPerArmy === 1)).toBe(true);
  const heroArmy = setArmyUnitCount(
    createArmy("Hero", new Date(0), "hero"),
    "brog-ironfist",
    10
  );
  expect(heroArmy.unitCounts["brog-ironfist"]).toBe(1);
});
