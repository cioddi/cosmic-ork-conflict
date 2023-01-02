import GameLog from "./GameLog";
import Miniature, { MiniatureOptions } from "./Miniature";
import Player, { PlayerInterface } from "./Player";
import * as turf from "@turf/turf";

export interface MiniatureGeoJsonFeature {
  type: "Feature";
  geometry: { type: string; coordinates: number[] };
  properties: Omit<MiniatureOptions, "position"> & {playerId: number};
}
export interface GameStateFeatureCollectionType {
  type: "FeatureCollection";
  features: MiniatureGeoJsonFeature[];
}

export default class Game {
  // Properties for each game
  public players: Player[];
  public currentPlayer: number;
  public gameLog: GameLog;
  public round: number;
  public winner: number | undefined;

  constructor(players: Player[]) {
    console.log(players);
    this.players = players;
    this.currentPlayer = 0;
    this.gameLog = new GameLog();
    this.round = 0;
  }

  // Method to switch active player
  switchPlayers(): void {
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    if (this.currentPlayer === 0) {
      this.round += 1;
    }
  }

  isOver(): boolean {
    const playersWithLivingMinis = this.players.filter((player) => {
      return player.miniatures.some(
        (miniature) => miniature.state.hitpoints > 0
      );
    });

    if(playersWithLivingMinis.length === 1){
      this.winner = playersWithLivingMinis[0].id
      return true;
    }
    return false;
  }

  // Method to check if a given miniature is within range of a target
  inRange(miniature: Miniature, target: Miniature, range: number): boolean {
    const dx = miniature.state.position[0] - target.state.position[0];
    const dy = miniature.state.position[1] - target.state.position[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= range;
  }

  // This function takes in a miniature and a player as input, and returns the nearest enemy miniature to the given miniature.
  getNearestEnemy(miniature: Miniature, player: Player): Miniature | null {
    let nearestEnemy: Miniature | null = null;
    let minDistance = Infinity;
    for (const enemyPlayer of this.players) {
      if (enemyPlayer === player) {
        continue;
      }
      for (const enemyMiniature of enemyPlayer.miniatures) {
        if (enemyMiniature.state.hitpoints > 0) {
          const { distance } = this.getDistanceAndBearing(
            miniature,
            enemyMiniature
          );

          if (distance < minDistance) {
            nearestEnemy = enemyMiniature;
            minDistance = distance;
          }
        }
      }
    }
    return nearestEnemy;
  }

  //This function calculates the distance and bearing between two miniature instances by using the positions of the miniatures, which are represented as longitude and latitude coordinates. It uses the Haversine formula to calculate the distance between the two positions in meters, and calculates the bearing as the angle in degrees between the two positions, with 0 degrees indicating that the second position is directly east of the first position.
  getDistanceAndBearing(
    miniature1: Miniature,
    miniature2: Miniature
  ): { distance: number; bearing: number } {
    // Create Point features for the miniatures
    const point1 = turf.point(miniature1.state.position);
    const point2 = turf.point(miniature2.state.position);
    // Calculate distance using turf.distance
    const distance = turf.distance(point1, point2, { units: "meters" });
    // Calculate bearing using turf.bearing
    const bearing = turf.bearing(point1, point2);
    // Return distance and bearing as an array
    return { distance, bearing };
  }

  getAvailableMinis(miniatures: Miniature[]): Miniature[] {
    return miniatures.filter((mini) => mini.state.hitpoints > 0);
  }

  getAvailableEnemyMinis(player: Player): Miniature[] {
    const enemy = this.players.find((p) => p !== player);
    return enemy ? this.getAvailableMinis(enemy.miniatures) : [];
  }
  // Move miniature by specified distance in specified direction
  move(
    player: PlayerInterface,
    miniature: Miniature,
    distanceAndBearing: [number, number][]
  ): void {
    // Iterate through each distance and bearing pair
    for (const [distance, bearing] of distanceAndBearing) {
      // Calculate new longitude and latitude based on distance and bearing
      const [longitude, latitude] = turf.destination(
        miniature.state.position,
        distance,
        bearing,
        { units: "meters" }
      ).geometry.coordinates;
      // Update miniature position
      miniature.state.position = [longitude, latitude];
    }
    // Log move action in game log
    this.gameLog.push({
      playerName: player.name,
      miniature: miniature.state,
      action: "move",
      distanceAndBearing,
    });
  }

  // Method to roll a random number between 1 and 6
  roll(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  // Attack enemy miniature in melee
  melee(
    player: PlayerInterface,
    attacker: Miniature,
    defender: Miniature
  ): void {
    // Roll attack and defense dice
    const attackRoll = this.roll();
    // Calculate damage
    let damage = Math.max(
      0,
      attackRoll + attacker.state.meleeAttack - defender.state.armour
    );
    // Apply attack roll failure
    if (attackRoll === 1) {
      damage = 0;
    }
    // Apply damage to defender
    defender.takeDamage(damage);

    if (typeof attacker.state?.damageDealt !== "undefined") {
      attacker.state.damageDealt += damage;
    }

    if (
      defender.state?.id &&
      typeof attacker.state?.killCount !== "undefined" &&
      defender.state?.hitpoints <= 0
    ) {
      attacker.state.killCount++;
      attacker.state.unitsKilled?.push(defender.state?.id);
    }
    // Log melee action in game log
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

  // Attack enemy miniature with ranged weapon
  ranged(player: Player, attacker: Miniature, defender: Miniature): void {
    // Roll dice for attacker
    const attackRoll = this.roll();
    // Check if attack hits based on roll and ranged attack stat
    let hit = false;
    if (attackRoll >= attacker.state.rangeAttack) {
      hit = true;
    }
    // Calculate damage based on hit, attack roll and armour and hitpoints of defender
    const damage = hit ? Math.max(0, attackRoll - defender.state.armour) : 0;
    // Inflict damage on defender
    defender.takeDamage(damage);

    if (attacker.state?.damageDealt) {
      attacker.state.damageDealt += damage;
      console.log("unit damage: ", defender.state.name);
    }

    if (
      defender.state?.id &&
      attacker.state?.killCount &&
      defender.state?.hitpoints <= 0
    ) {
      console.log("unit killed: ", defender.state.name);
      attacker.state.killCount++;
      attacker.state.unitsKilled?.push(defender.state?.id);
    }
    // Add ranged action to gamelog
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

  // Method to get the current game state as a GeoJSON object
  getGameStateAsGeoJSON(): GameStateFeatureCollectionType {
    const features = this.players.flatMap((player) =>
      player.miniatures.map((miniature) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point",
          coordinates: miniature.state.position,
        },
        properties: {
          ...(({ position, ...rest }: MiniatureOptions) => rest)(
            miniature.state
          ),
          playerId: player.id,
        },
      }))
    );

    return {
      type: "FeatureCollection",
      features: features,
    };
  }
}
