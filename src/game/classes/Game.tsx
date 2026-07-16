import GameLog from "./GameLog";
import Miniature, { MiniatureOptions } from "./Miniature";
import { PlayerInterface } from "./Player";
import { GridNavigation } from "../navigation/GridNavigation";
import { GameWorld, WorldPoint, distance, interpolate } from "../world";
import { DEFAULT_GAME_RULES, GameRules } from "../rules";

const MIN_SEGMENT_LENGTH_METERS = 0.001;
const FALLBACK_DIRECTION_SAMPLES = 64;

export interface MovementTrace {
  unitId: string;
  points: WorldPoint[];
  segmentLengths: number[];
  totalDistance: number;
  startedAtTick: number;
}

export interface UnitSnapshot {
  playerId: number;
  position: WorldPoint;
  properties: Omit<MiniatureOptions, "position">;
}

export interface GameSnapshot {
  tick: number;
  units: UnitSnapshot[];
  movementTraces: MovementTrace[];
}

export type MovementResult =
  | { status: "moved"; trace: MovementTrace }
  | { status: "blocked"; reason: "no-path" | "invalid-segment" | "invalid-budget" };

export interface ReachableEnemyPlan {
  enemy: Miniature;
  path: WorldPoint[];
}

export default class Game {
  public readonly players: PlayerInterface[];
  public currentPlayer = 0;
  public readonly gameLog = new GameLog();
  public round = 0;
  public winner: number | undefined;
  public readonly world: GameWorld;
  public readonly navigation: GridNavigation;
  public readonly rules: Readonly<GameRules>;

  private tick = 0;
  private movementTraces: MovementTrace[] = [];

  constructor(
    players: PlayerInterface[],
    world: GameWorld,
    navigation: GridNavigation = new GridNavigation(world),
    private readonly random: () => number = Math.random,
    rules: Readonly<GameRules> = DEFAULT_GAME_RULES
  ) {
    this.players = players;
    this.world = world;
    this.navigation = navigation;
    this.rules = rules;
  }

  beginStep(): void {
    this.tick++;
    this.movementTraces = [];
  }

  switchPlayers(): void {
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    if (this.currentPlayer === 0) this.round += 1;
  }

  isOver(): boolean {
    const livingPlayers = this.players.filter((player) =>
      player.miniatures.some((miniature) => miniature.state.hitpoints > 0)
    );
    if (livingPlayers.length === 1) {
      this.winner = livingPlayers[0].id;
      return true;
    }
    return false;
  }

  inRange(miniature: Miniature, target: Miniature, range: number): boolean {
    return distance(miniature.state.position, target.state.position) <= range;
  }

  getNearestEnemy(miniature: Miniature, player: PlayerInterface): Miniature | null {
    let nearest: Miniature | null = null;
    let nearestDistance = Infinity;
    for (const enemyPlayer of this.players) {
      if (enemyPlayer === player) continue;
      for (const enemy of enemyPlayer.miniatures) {
        if (enemy.state.hitpoints <= 0) continue;
        const candidateDistance = distance(miniature.state.position, enemy.state.position);
        if (candidateDistance < nearestDistance) {
          nearest = enemy;
          nearestDistance = candidateDistance;
        }
      }
    }
    return nearest;
  }

  getNearestReachableEnemy(
    miniature: Miniature,
    player: PlayerInterface
  ): Miniature | null {
    return this.getNearestReachableEnemyPlan(miniature, player)?.enemy ?? null;
  }

  getNearestReachableEnemyPlan(
    miniature: Miniature,
    player: PlayerInterface
  ): ReachableEnemyPlan | null {
    const profile = miniature.state.mobilityProfileId ?? "infantry";
    const enemies = this.getAvailableEnemyMinis(player).sort(
      (left, right) =>
        distance(miniature.state.position, left.state.position) -
        distance(miniature.state.position, right.state.position)
    );
    for (const enemy of enemies) {
      const path = this.navigation.findPath(
        miniature.state.position,
        enemy.state.position,
        profile
      );
      if (path.length >= 2) return { enemy, path };
    }
    return null;
  }

  getDistanceAndBearing(
    miniature1: Miniature,
    miniature2: Miniature
  ): { distance: number; bearing: number } {
    return distanceAndBearing(miniature1.state.position, miniature2.state.position);
  }

  getAvailableMinis(miniatures: Miniature[]): Miniature[] {
    return miniatures.filter((miniature) => miniature.state.hitpoints > 0);
  }

  getAvailableEnemyMinis(player: PlayerInterface): Miniature[] {
    return this.players
      .filter((candidate) => candidate !== player)
      .flatMap((candidate) => this.getAvailableMinis(candidate.miniatures));
  }

  navigateMiniature(
    player: PlayerInterface,
    miniature: Miniature,
    target: WorldPoint,
    movementBudget: number,
    plannedPath?: readonly WorldPoint[]
  ): MovementResult {
    if (!Number.isFinite(movementBudget) || movementBudget <= 0) {
      return { status: "blocked", reason: "invalid-budget" };
    }
    const profile = miniature.state.mobilityProfileId ?? "infantry";
    const start: WorldPoint = [...miniature.state.position];
    const path =
      plannedPath &&
      plannedPath.length >= 2 &&
      distance(start, plannedPath[0]) <= MIN_SEGMENT_LENGTH_METERS
        ? plannedPath
        : this.navigation.findPath(start, target, profile);
    if (path.length < 2) return { status: "blocked", reason: "no-path" };

    let remaining = movementBudget;
    let current: WorldPoint = start;
    const traveled: WorldPoint[] = [start];
    const segmentLengths: number[] = [];

    for (let index = 1; index < path.length && remaining > 0; index++) {
      const waypoint = path[index];
      const segmentDistance = distance(current, waypoint);
      if (segmentDistance <= MIN_SEGMENT_LENGTH_METERS) continue;
      const next =
        segmentDistance <= remaining
          ? ([...waypoint] as WorldPoint)
          : interpolate(current, waypoint, remaining / segmentDistance);
      const traveledDistance = distance(current, next);
      if (!this.world.canTraverse(current, next, profile)) {
        return { status: "blocked", reason: "invalid-segment" };
      }
      traveled.push(next);
      segmentLengths.push(traveledDistance);
      remaining -= traveledDistance;
      current = next;
    }

    if (traveled.length < 2) return { status: "blocked", reason: "no-path" };
    return this.commitMovement(player, miniature, traveled);
  }

  /**
   * Uses normal pathfinding first, then makes a short collision-safe local step.
   * The fallback preserves continuous movement and never crosses an obstacle.
   */
  moveMiniatureToward(
    player: PlayerInterface,
    miniature: Miniature,
    target: WorldPoint,
    movementBudget: number,
    plannedPath?: readonly WorldPoint[]
  ): MovementResult {
    const routed = this.navigateMiniature(
      player,
      miniature,
      target,
      movementBudget,
      plannedPath
    );
    if (routed.status === "moved" || routed.reason === "invalid-budget") {
      return routed;
    }

    const start: WorldPoint = [...miniature.state.position];
    const profile = miniature.state.mobilityProfileId ?? "infantry";
    const minimumStep = Math.min(
      movementBudget,
      this.rules.minimumMovementMeters
    );
    const stepLengths: number[] = [];
    let stepLength = movementBudget;
    while (stepLength > minimumStep) {
      stepLengths.push(stepLength);
      stepLength /= 2;
    }
    stepLengths.push(minimumStep);

    const targetAngle = Math.atan2(target[1] - start[1], target[0] - start[0]);
    for (const candidateLength of stepLengths) {
      if (candidateLength <= MIN_SEGMENT_LENGTH_METERS) continue;
      let bestPoint: WorldPoint | undefined;
      let bestTargetDistance = Infinity;
      for (let index = 0; index < FALLBACK_DIRECTION_SAMPLES; index++) {
        const angle =
          targetAngle + (index * Math.PI * 2) / FALLBACK_DIRECTION_SAMPLES;
        const candidate: WorldPoint = [
          start[0] + Math.cos(angle) * candidateLength,
          start[1] + Math.sin(angle) * candidateLength,
        ];
        if (!this.world.canTraverse(start, candidate, profile)) continue;
        const targetDistance = distance(candidate, target);
        if (targetDistance < bestTargetDistance) {
          bestPoint = candidate;
          bestTargetDistance = targetDistance;
        }
      }
      if (bestPoint) {
        return this.commitMovement(player, miniature, [start, bestPoint]);
      }
    }

    return { status: "blocked", reason: "no-path" };
  }

  private commitMovement(
    player: PlayerInterface,
    miniature: Miniature,
    traveled: WorldPoint[]
  ): MovementResult {
    const segmentLengths = traveled
      .slice(1)
      .map((point, index) => distance(traveled[index], point));
    const current = traveled[traveled.length - 1];
    miniature.state.position = [...current];
    const trace: MovementTrace = {
      unitId: miniature.state.id ?? "unknown-unit",
      points: traveled,
      segmentLengths,
      totalDistance: segmentLengths.reduce((sum, value) => sum + value, 0),
      startedAtTick: this.tick,
    };
    this.movementTraces.push(trace);
    this.gameLog.push({
      playerName: player.name,
      miniature: miniature.state,
      action: "move",
      distanceAndBearing: segmentLengths.map((length, index) => [
        length,
        distanceAndBearing(traveled[index], traveled[index + 1]).bearing,
      ]),
    });
    return { status: "moved", trace };
  }

  roll(): number {
    return Math.floor(this.random() * 6) + 1;
  }

  melee(player: PlayerInterface, attacker: Miniature, defender: Miniature): void {
    const attackRoll = this.roll();
    let damage = Math.max(
      0,
      attackRoll + attacker.state.meleeAttack - defender.state.armour
    );
    if (attackRoll === 1) damage = 0;
    defender.takeDamage(damage);
    attacker.state.damageDealt += damage;
    if (defender.state.id && defender.state.hitpoints <= 0) {
      attacker.state.killCount++;
      attacker.state.unitsKilled.push(defender.state.id);
    }
    this.gameLog.push({
      playerName: player.name,
      miniature: attacker.state,
      action: "melee",
      attackRoll,
      damage,
      target: defender.state,
      hit: damage > 0,
    });
  }

  ranged(player: PlayerInterface, attacker: Miniature, defender: Miniature): void {
    const attackRoll = this.roll();
    const hit = attackRoll >= attacker.state.rangeAttack;
    const damage = hit ? Math.max(0, attackRoll - defender.state.armour) : 0;
    defender.takeDamage(damage);
    attacker.state.damageDealt += damage;
    if (defender.state.id && defender.state.hitpoints <= 0) {
      attacker.state.killCount++;
      attacker.state.unitsKilled.push(defender.state.id);
    }
    this.gameLog.push({
      playerName: player.name,
      miniature: attacker.state,
      action: "ranged",
      target: defender.state,
      attackRoll,
      hit,
      damage,
    });
  }

  getSnapshot(): GameSnapshot {
    return {
      tick: this.tick,
      movementTraces: this.movementTraces.map((trace) => ({
        ...trace,
        points: trace.points.map((point) => [...point]),
        segmentLengths: [...trace.segmentLengths],
      })),
      units: this.players.flatMap((player) =>
        player.miniatures.map((miniature) => ({
          playerId: player.id,
          position: [...miniature.state.position] as WorldPoint,
          properties: (({ position, ...properties }: MiniatureOptions) => ({
            ...properties,
            unitsKilled: [...properties.unitsKilled],
            weapons: properties.weapons.map((weapon) => ({ ...weapon })),
            size: { ...properties.size },
          }))(miniature.state),
        }))
      ),
    };
  }
}

function distanceAndBearing(
  from: WorldPoint,
  to: WorldPoint
): { distance: number; bearing: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return {
    distance: Math.hypot(dx, dy),
    bearing: (Math.atan2(dx, dy) * 180) / Math.PI,
  };
}
