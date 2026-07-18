import { CSSProperties } from "react";
import Game from "./Game";
import Miniature, { WeaponInterface } from "./Miniature";
import { PlayerInterface } from "./Player";

export default class SequentialAI implements PlayerInterface {
  id: number;
  name: string;
  miniatures: Miniature[];
  actionIndex: number;
  color: CSSProperties['color'];

  constructor(id: number, name: string, miniatures: Miniature[], color: CSSProperties['color']) {
    this.id = id;
    this.name = name;
    this.miniatures = miniatures;
    this.color = color;
    this.actionIndex = 0;
  }

  // Method to choose an action for a given miniature
  chooseAction(game: Game, miniature: Miniature): "move" | "melee" | "range" {
    // Find all enemy miniatures within range
    const enemiesInRange = game.players
      .filter((player) => player !== this)
      .flatMap((player) => player.miniatures)
      .filter((enemy) =>
        game.inRange(miniature, enemy, miniature.state.meleeAttack)
      );

    // If there are any enemies within range, attack a random one
    if (enemiesInRange.length > 0) {
      return "melee";
    }

    // Otherwise, move towards the nearest enemy
    return "move";
  }

  // Method to find the nearest enemy miniature
  findNearest(miniature: Miniature, enemies: Miniature[]): Miniature {
    let nearestEnemy = enemies[0];
    let nearestDistance = Infinity;
    for (const enemy of enemies) {
      const dx = miniature.state.position[0] - enemy.state.position[0];
      const dy = miniature.state.position[1] - enemy.state.position[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < nearestDistance) {
        nearestEnemy = enemy;
        nearestDistance = distance;
      }
    }
    return nearestEnemy;
  }

  // Method to play the game until a winner is determined
  playRound(game: Game): void {
    const availableMinis = game.getAvailableMinis(this.miniatures);
    availableMinis.forEach((mini) => {
      const plan = game.getNearestReachableEnemyPlan(mini, this);
      const enemyMini = plan?.enemy ?? game.getNearestEnemy(mini, this);
      if (!enemyMini) return;

      const preferredWeapon = this.getPreferredWeapon(game, mini);
      const preferredRange = preferredWeapon
        ? Math.max(preferredWeapon.range, game.rules.closeCombatRangeMeters)
        : game.rules.closeCombatRangeMeters;
      const distance = game.getDistanceAndBearing(mini, enemyMini).distance;

      // Advance only as far as the selected weapon needs. Ranged units now
      // maintain firing distance instead of charging into close combat.
      if (distance > preferredRange) {
        const movementBudget = Math.min(
          mini.state.speed * game.rules.movementDistanceMultiplier,
          distance - preferredRange
        );
        if (movementBudget > 0) {
          game.moveMiniatureToward(
            this,
            mini,
            [...enemyMini.state.position],
            movementBudget,
            plan?.enemy === enemyMini ? plan.path : undefined
          );
        }
      }

      const distanceAfterMovement = game.getDistanceAndBearing(mini, enemyMini).distance;
      const usableWeapon = this.getUsableWeapon(game, mini, distanceAfterMovement);
      if (!usableWeapon || enemyMini.state.hitpoints <= 0) return;
      if (usableWeapon.range > game.rules.closeCombatRangeMeters) {
        game.ranged(this, mini, enemyMini, usableWeapon);
      } else {
        game.melee(this, mini, enemyMini, usableWeapon);
      }
    });

    game.switchPlayers();
  }

  private getPreferredWeapon(
    game: Game,
    miniature: Miniature
  ): WeaponInterface | undefined {
    return [...miniature.state.weapons].sort(
      (left, right) =>
        Math.max(right.range, game.rules.closeCombatRangeMeters) -
          Math.max(left.range, game.rules.closeCombatRangeMeters) ||
        right.damage - left.damage
    )[0];
  }

  private getUsableWeapon(
    game: Game,
    miniature: Miniature,
    distance: number
  ): WeaponInterface | undefined {
    return miniature.state.weapons
      .filter(
        (weapon) =>
          distance <= Math.max(weapon.range, game.rules.closeCombatRangeMeters)
      )
      .sort((left, right) => right.damage - left.damage || right.range - left.range)[0];
  }
}
