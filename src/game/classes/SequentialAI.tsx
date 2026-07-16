import { CSSProperties } from "react";
import Game from "./Game";
import Miniature from "./Miniature";
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
      let plan = game.getNearestReachableEnemyPlan(mini, this);
      let enemyMini = plan?.enemy ?? game.getNearestEnemy(mini, this);
      if (!enemyMini) return;

      let { distance } = game.getDistanceAndBearing(mini, enemyMini);
      const usableWeapon = mini.state.weapons
        .filter((weapon) => {
          const effectiveRange =
            weapon.range <= game.rules.closeCombatRangeMeters
              ? game.rules.closeCombatRangeMeters
              : weapon.range;
          return distance <= effectiveRange;
        })
        .sort((left, right) => right.range - left.range)[0];

      if (usableWeapon) {
        if (usableWeapon.range > game.rules.closeCombatRangeMeters) {
          game.ranged(this, mini, enemyMini);
        } else {
          game.melee(this, mini, enemyMini);
        }
      }

      if (enemyMini.state.hitpoints <= 0) {
        plan = game.getNearestReachableEnemyPlan(mini, this);
        enemyMini = plan?.enemy ?? game.getNearestEnemy(mini, this);
        if (!enemyMini) return;
        distance = game.getDistanceAndBearing(mini, enemyMini).distance;
      }

      if (enemyMini.state.hitpoints > 0 && distance > game.rules.closeCombatRangeMeters) {
        const movementBudget = Math.min(
          mini.state.speed * game.rules.movementDistanceMultiplier,
          distance - game.rules.closeCombatRangeMeters
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
    });

    game.switchPlayers();
  }
}
