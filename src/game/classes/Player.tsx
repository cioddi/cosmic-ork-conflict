import Game from "./Game";
import Miniature from "./Miniature";

export interface PlayerInterface {
  // The player's unique identifier
  id: number;
  // The player's name
  name: string;
  // The player's miniatures
  miniatures: Miniature[];
  // A function that determines the next action for a given miniature
  chooseAction?: (
    game: Game,
    miniature: Miniature
  ) => "move" | "melee" | "range";
  // A function that determines the movement path for a given miniature
  findNearest?: (miniature: Miniature, enemies: Miniature[]) => Miniature;
  playRound?: (game: Game, miniature: Miniature) => void;
}

export default class Player implements PlayerInterface {
  // Properties for each player
  id: number;
  name: string;
  miniatures: Miniature[];

  constructor(id: number, name: string, miniatures: Miniature[]) {
    this.id = id;
    this.name = name;
    this.miniatures = miniatures;
  }
}
