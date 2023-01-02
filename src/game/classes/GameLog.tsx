import { MiniatureOptions } from "./Miniature";

export default class GameLog {
  private log: GameLogEntry[][] = [];

  push(entry: GameLogEntry): void {
    if (this.log.length === 0 || this.log[this.log.length - 1].length === 2) {
      this.log.push([]);
    }

    //console.log(entry.action, entry?.attackRoll, entry?.hit, entry?.damage,entry?.distanceAndBearing);

    this.log[this.log.length - 1].push(entry);
  }

  getLog(): GameLogEntry[][] {
    return this.log;
  }
}

export interface GameLogEntry {
  playerName: string;
  miniature: MiniatureOptions;
  action: "move" | "melee" | "ranged";
  distanceAndBearing?: [number, number][];
  target?: MiniatureOptions;
  hit?: boolean;
  attackRoll?: number;
  defenseRoll?: number;
  damage?: number;
}
