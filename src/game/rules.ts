export interface GameRules {
  /** Multiplier applied to each unit's base speed for one simulation turn. */
  movementDistanceMultiplier: number;
  /** Distance at which units stop closing and resolve close combat. */
  closeCombatRangeMeters: number;
  /** Smallest collision-safe fallback step attempted when routing cannot progress. */
  minimumMovementMeters: number;
}

export const DEFAULT_GAME_RULES: Readonly<GameRules> = Object.freeze({
  movementDistanceMultiplier: 4,
  closeCombatRangeMeters: 2,
  minimumMovementMeters: 0.5,
});
