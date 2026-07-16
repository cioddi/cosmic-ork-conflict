import { GameWorld } from "./GameWorld";
import { pointInPolygon } from "./geometry";
import { WorldPoint } from "./types";

export type RandomSource = () => number;

export function findSpawnPoint(
  world: GameWorld,
  setupAreaIndex: number,
  mobilityProfileId: string,
  random: RandomSource = Math.random,
  maxAttempts = 200,
  additionalValidation: (point: WorldPoint) => boolean = () => true
): WorldPoint {
  const area = world.setupAreas[setupAreaIndex];
  if (!area) throw new Error(`Unknown setup area: ${setupAreaIndex}`);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const point: WorldPoint = [
      area.bounds.minX + random() * (area.bounds.maxX - area.bounds.minX),
      area.bounds.minY + random() * (area.bounds.maxY - area.bounds.minY),
    ];
    if (
      pointInPolygon(point, area) &&
      world.canOccupy(point, mobilityProfileId) &&
      additionalValidation(point)
    ) {
      return point;
    }
  }
  throw new Error(
    `Unable to find a valid ${mobilityProfileId} spawn in setup area ${setupAreaIndex}`
  );
}

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
