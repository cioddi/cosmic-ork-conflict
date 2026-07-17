import { orcUnits } from "../armylist/orcs";
import { MiniatureOptions, MiniatureType } from "../classes/Miniature";

export type UnitTemplate = Omit<
  MiniatureOptions,
  "unitsKilled" | "damageDealt" | "killCount"
>;

export interface UnitCatalogEntry {
  id: string;
  points: number;
  template: UnitTemplate;
}

const UNIT_IDS = [
  "brog-ironfist",
  "goblin-snikkitz",
  "orc-biker",
  "ork-boss-biker",
  "skabrot-the-terrible",
  "gorgutz-the-invader",
  "krog-the-despoiler",
] as const;

/**
 * A small deterministic balance formula. It intentionally lives with the game
 * rules instead of relying on mutable third-party army data.
 */
export function calculateUnitPointCost(template: UnitTemplate): number {
  const hasRangedWeapon = template.weapons.some((weapon) => weapon.range > 2);
  const weaponPoints = template.weapons.reduce(
    (total, weapon) => total + weapon.damage * 4 + weapon.range,
    0
  );
  const typePoints =
    template.type === MiniatureType.VEHICLE
      ? 10
      : template.type === MiniatureType.CHARACTER
      ? 5
      : 0;
  const rangedAccuracyPoints = hasRangedWeapon
    ? Math.max(0, 7 - template.rangeAttack) * 3
    : 0;
  const raw =
    template.hitpoints * 2 +
    template.armour * 6 +
    template.speed +
    template.meleeAttack * 4 +
    rangedAccuracyPoints +
    weaponPoints +
    typePoints;
  return Math.max(5, Math.round(raw / 5) * 5);
}

export const UNIT_CATALOG: readonly UnitCatalogEntry[] = Object.freeze(
  orcUnits.map((template, index) => ({
    id: UNIT_IDS[index] ?? `unit-${index}`,
    points: calculateUnitPointCost(template),
    template,
  }))
);

export const UNIT_CATALOG_BY_ID = new Map(
  UNIT_CATALOG.map((entry) => [entry.id, entry])
);
