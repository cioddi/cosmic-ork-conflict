import { UNIT_CATALOG, UNIT_CATALOG_BY_ID } from "./catalog";
import { createId as createCompatibleId } from "../../utils/createId";

export const ARMY_STORAGE_KEY = "cosmic-ork-conflict.armies.v1";
export const ARMY_STORAGE_VERSION = 1;
export const MAX_UNITS_PER_ARMY = 48;
export const DEFAULT_POINT_LIMIT = 500;

export interface ArmyDefinition {
  id: string;
  name: string;
  unitCounts: Record<string, number>;
  pointLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BattleArmies {
  first: ArmyDefinition;
  second: ArmyDefinition;
}

interface StoredArmyCollection {
  version: number;
  armies: ArmyDefinition[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createArmy(
  name = "New warband",
  now = new Date(),
  id = createId()
): ArmyDefinition {
  const timestamp = now.toISOString();
  return {
    id,
    name,
    unitCounts: {},
    pointLimit: DEFAULT_POINT_LIMIT,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getArmyUnitCount(army: ArmyDefinition): number {
  return Object.values(army.unitCounts).reduce((total, count) => total + count, 0);
}

export function getArmyPointCost(army: ArmyDefinition): number {
  return Object.entries(army.unitCounts).reduce((total, [unitId, count]) => {
    const entry = UNIT_CATALOG_BY_ID.get(unitId);
    return total + (entry?.points ?? 0) * count;
  }, 0);
}

export function setArmyUnitCount(
  army: ArmyDefinition,
  unitId: string,
  requestedCount: number,
  now = new Date()
): ArmyDefinition {
  const entry = UNIT_CATALOG_BY_ID.get(unitId);
  if (!entry || !Number.isFinite(requestedCount)) return army;
  const currentCount = army.unitCounts[unitId] ?? 0;
  const otherUnitCount = getArmyUnitCount(army) - currentCount;
  const count = Math.max(
    0,
    Math.min(
      Math.floor(requestedCount),
      entry.maxPerArmy,
      MAX_UNITS_PER_ARMY - otherUnitCount
    )
  );
  if (count === currentCount) return army;
  const unitCounts = { ...army.unitCounts };
  if (count === 0) delete unitCounts[unitId];
  else unitCounts[unitId] = count;
  const candidate = { ...army, unitCounts, updatedAt: now.toISOString() };
  if (
    candidate.pointLimit !== null &&
    getArmyPointCost(candidate) > candidate.pointLimit &&
    getArmyPointCost(candidate) >= getArmyPointCost(army)
  ) {
    return army;
  }
  return candidate;
}

export function saveArmyCollection(
  storage: StorageLike,
  armies: readonly ArmyDefinition[]
): void {
  const payload: StoredArmyCollection = {
    version: ARMY_STORAGE_VERSION,
    armies: armies.map((army) => normalizeArmy(army)).filter(isUsableArmy),
  };
  storage.setItem(ARMY_STORAGE_KEY, JSON.stringify(payload));
}

export function loadArmyCollection(storage: StorageLike): ArmyDefinition[] {
  const serialized = storage.getItem(ARMY_STORAGE_KEY);
  if (!serialized) return [];
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value) || value.version !== ARMY_STORAGE_VERSION) return [];
    if (!Array.isArray(value.armies)) return [];
    return value.armies
      .map(parseArmy)
      .filter(
        (army): army is ArmyDefinition => Boolean(army && isUsableArmy(army))
      );
  } catch {
    return [];
  }
}

export function upsertArmy(
  armies: readonly ArmyDefinition[],
  army: ArmyDefinition
): ArmyDefinition[] {
  const normalized = normalizeArmy(army);
  const index = armies.findIndex((candidate) => candidate.id === normalized.id);
  if (index < 0) return [...armies, normalized];
  return armies.map((candidate, candidateIndex) =>
    candidateIndex === index ? normalized : candidate
  );
}

export function generateRandomArmy(
  targetPoints: number,
  random: () => number = Math.random,
  name = "Random raiders"
): ArmyDefinition {
  const target = Math.max(
    Math.min(...UNIT_CATALOG.map((entry) => entry.points)),
    Math.round(targetPoints)
  );
  const tolerance = Math.max(15, Math.round(target * 0.08));
  let army = createArmy(name);
  army = { ...army, pointLimit: null };

  for (let index = 0; index < MAX_UNITS_PER_ARMY; index++) {
    const total = getArmyPointCost(army);
    if (total >= target - tolerance) break;
    const remaining = target - total;
    const candidates = UNIT_CATALOG.filter(
      (entry) =>
        entry.points <= remaining + tolerance &&
        (army.unitCounts[entry.id] ?? 0) < entry.maxPerArmy
    );
    if (candidates.length === 0) break;
    const randomIndex = Math.max(
      0,
      Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
    );
    const entry = candidates[randomIndex];
    army = setArmyUnitCount(
      army,
      entry.id,
      (army.unitCounts[entry.id] ?? 0) + 1
    );
  }

  if (getArmyUnitCount(army) === 0) {
    const cheapest = [...UNIT_CATALOG].sort((left, right) => left.points - right.points)[0];
    army = setArmyUnitCount(army, cheapest.id, 1);
  }
  return army;
}

export function expandArmyUnitIds(army: ArmyDefinition): string[] {
  return UNIT_CATALOG.flatMap((entry) =>
    Array.from({ length: army.unitCounts[entry.id] ?? 0 }, () => entry.id)
  );
}

export function isUsableArmy(army: ArmyDefinition): boolean {
  const entries = Object.entries(army.unitCounts);
  const count = getArmyUnitCount(army);
  return (
    army.name.trim().length > 0 &&
    entries.every(
      ([unitId, unitCount]) =>
        UNIT_CATALOG_BY_ID.has(unitId) &&
        Number.isInteger(unitCount) &&
        unitCount > 0 &&
        unitCount <= UNIT_CATALOG_BY_ID.get(unitId)!.maxPerArmy
    ) &&
    count > 0 &&
    count <= MAX_UNITS_PER_ARMY &&
    (army.pointLimit === null ||
      (Number.isFinite(army.pointLimit) &&
        army.pointLimit >= 50 &&
        getArmyPointCost(army) <= army.pointLimit))
  );
}

function parseArmy(value: unknown): ArmyDefinition | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !(
      value.pointLimit === null ||
      (typeof value.pointLimit === "number" && Number.isFinite(value.pointLimit))
    ) ||
    !isRecord(value.unitCounts)
  ) {
    return null;
  }
  const unitCounts: Record<string, number> = {};
  for (const [unitId, count] of Object.entries(value.unitCounts)) {
    if (
      !UNIT_CATALOG_BY_ID.has(unitId) ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count <= 0
    ) return null;
    unitCounts[unitId] = count;
  }
  return normalizeArmy({
    id: value.id,
    name: value.name,
    unitCounts,
    pointLimit: value.pointLimit,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

function normalizeArmy(army: ArmyDefinition): ArmyDefinition {
  const unitCounts: Record<string, number> = {};
  let remaining = MAX_UNITS_PER_ARMY;
  for (const entry of UNIT_CATALOG) {
    const count = Math.max(
      0,
      Math.min(
        remaining,
        entry.maxPerArmy,
        Math.floor(army.unitCounts[entry.id] ?? 0)
      )
    );
    if (count > 0) unitCounts[entry.id] = count;
    remaining -= count;
  }
  return {
    ...army,
    name: army.name.trim().slice(0, 60) || "Unnamed warband",
    unitCounts,
    pointLimit:
      army.pointLimit === null
        ? null
        : Math.max(50, Math.min(10_000, Math.round(army.pointLimit))),
  };
}

function createId(): string {
  return createCompatibleId("army");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
