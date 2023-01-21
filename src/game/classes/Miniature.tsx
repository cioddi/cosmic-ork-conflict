import { v4 as uuidv4 } from "uuid";

export enum MiniatureType {
  // A unique individual or hero.
  CHARACTER,
  // A machine or vehicle used for transportation or combat.
  VEHICLE,
  // A machine that can be programmed to perform tasks.
  ROBOT,
  // A group of soldiers or warriors.
  INFANTRY,
}

export interface WeaponInterface {
  name: string;
  description: string;
  damage: number;
  range: number;
}

export interface MiniatureOptions {
  name: string;
  id?: string;
  description: string;
  type: MiniatureType;
  size: { x: number; y: number; z: number };
  position: [number, number];
  bearing: number;
  speed: number;
  meleeAttack: number;
  rangeAttack: number;
  armour: number;
  hitpoints: number;
  weapons: WeaponInterface[];
  damageDealt: number;
  killCount: number;
  unitsKilled: string[];
  image?: string;
}
export type MiniatureParams = Omit<MiniatureOptions,"unitsKilled" | "damageDealt" | "killCount">;

export default class Miniature {
  public state: MiniatureOptions;

  constructor(options: MiniatureParams) {
    this.state = { ...options, id: uuidv4(), damageDealt:0 , unitsKilled:[], killCount:0};
  }

  // Method to apply damage to a miniature
  takeDamage(damage: number): void {
    this.state.hitpoints -= damage;
  }
}
