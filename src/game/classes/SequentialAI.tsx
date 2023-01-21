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
  playRound(game: Game) {

    // Find all available miniatures for this player
    const availableMinis = game.getAvailableMinis(this.miniatures);

    // Check if any of them are in range to attack the enemy
    const attackingMinis = availableMinis.filter((mini) => {
      const enemy = game.getNearestEnemy(mini, this);
      
      const {distance} = enemy
        ? game.getDistanceAndBearing(mini, enemy)
        : {distance:Infinity};

      // Check if any of the miniature's weapons are in range
      return mini.state.weapons.some((weapon) => distance <= weapon.range);
    });
    //console.log('attackingMinis',attackingMinis);
    

    // Attack with all miniatures that can attack
    attackingMinis.forEach((mini) => {
      const enemyMini = game.getNearestEnemy(mini, this);
      if (enemyMini) {
        game.melee(this, mini, enemyMini);
      }
    });

    // Find all miniatures that didn't attack
    const nonAttackingMinis = availableMinis.filter(
      (mini) => !attackingMinis.includes(mini)
    );

    //console.log('nonAttackingMinis',nonAttackingMinis?.[0]?.state?.position);
    // Move all miniatures that didn't attack towards the enemy
    nonAttackingMinis.forEach((mini) => {
      const enemyMini = game.getNearestEnemy(mini, this);

      if (!enemyMini) return;

      const distanceAndBearing = game.getDistanceAndBearing(mini, enemyMini);

      //console.log("distance", distanceAndBearing);
      
      // Calculate how far the miniature can move this round
      const movement = mini?.state.speed;
      const { distance, bearing } = distanceAndBearing;

      if (movement >= distance) {
        // The miniature can reach the enemy this round, so move it as close as possible
        game.move(this, mini, [[distance, bearing]]);
      } else {
        // The miniature can't reach the enemy this round, so move it as far as it can
        game.move(this, mini, [[movement, bearing]]);
      }
    });

    // End the round and switch to the other player
    game.switchPlayers();
  }
}
