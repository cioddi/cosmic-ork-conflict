import { MiniatureOptions, MiniatureType } from "../classes/Miniature";
export const orcUnits: Omit<MiniatureOptions,"unitsKilled" | "damageDealt" | "killCount">[] = [
  {
    name: "Brog Ironfist",
    description: "A brutish orc chieftain with a fierce reputation",
    size: { x: 1, y: 15, z: 30 },
    position: [0, 0],
    bearing: 0,
    speed: 3,
    hitpoints: 18,
    armour: 3,
    meleeAttack: 3,
    rangeAttack: 0,
    weapons: [
      {
        name: "Great Maul",
        description: "A massive two-handed hammer",
        damage: 4,
        range: 1,
      },
      {
        name: "Brass Knuckles",
        description: "A pair of brass knuckles",
        damage: 2,
        range: 0,
      },
    ],
    type: MiniatureType.CHARACTER,
    image: 'assets/character_1.png'
  },
  {
    name: "Goblin Snikkitz",
    description: "A sneaky goblin with a fondness for explosives",
    size: { x: 1, y: 10, z: 20 },
    position: [0, 0],
    bearing: 0,
    speed: 6,
    hitpoints: 6,
    armour: 2,
    meleeAttack: 0,
    rangeAttack: 2,
    weapons: [
      {
        name: "Slingshot",
        description: "A small, primitive ranged weapon",
        damage: 1,
        range: 10,
      },
      {
        name: "Stick of Dynamite",
        description: "A crude, but effective explosive",
        damage: 6,
        range: 3,
      },
    ],
    type: MiniatureType.INFANTRY,
  },
  {
    name: "Orc Biker",
    description: "A hulking orc biker with a love for speed",
    size: { x: 2, y: 30, z: 50 },
    position: [0, 0],
    bearing: 0,
    speed: 12,
    hitpoints: 12,
    armour: 2,
    meleeAttack: 3,
    rangeAttack: 0,
    weapons: [
      {
        name: "Chainsaw",
        description: "A loud and vicious chainsaw",
        damage: 5,
        range: 1,
      },
      {
        name: "Pistol",
        description: "A small, but powerful ranged weapon",
        damage: 3,
        range: 6,
      },
    ],
    type: MiniatureType.VEHICLE,
    image: 'assets/biker_1.png'
  },
  {
    name: "Ork boss biker",
    description:
      "A hulking brute of an Ork, Gorgor is feared by all those who cross his path. Armed with a massive power klaw and mounted on a battered warbike, he revels in the destruction he causes on the battlefield.",
    type: MiniatureType.VEHICLE,
    size: { x: 2, y: 2, z: 3 },
    position: [0, 0],
    bearing: 0,
    speed: 14,
    meleeAttack: 5,
    rangeAttack: 0,
    armour: 3,
    hitpoints: 14,
    weapons: [
      {
        name: "Power Klaw",
        description:
          "A massive, powered claw that can tear through even the toughest armor.",
        damage: 8,
        range: 0,
      },
    ],
  },
  {
    name: "Skabrot the Terrible",
    description:
      "An infamous Ork warboss leader, Skabrot is known for his brutal tactics and relentless pursuit of victory. Armed with a snazgun and mounted on a heavily-armed warbuggy, he is a force to be reckoned with on the battlefield.",
    type: MiniatureType.CHARACTER,
    size: { x: 2, y: 2, z: 3 },
    position: [0, 0],
    bearing: 0,
    speed: 20,
    meleeAttack: 3,
    rangeAttack: 3,
    armour: 3,
    hitpoints: 8,
    weapons: [
      {
        name: "Snazgun",
        description:
          "A rapid-fire gun that can spit out a hail of bullets in a short amount of time.",
        damage: 4,
        range: 12,
      },
    ],
  },
  {
    name: "Gorgutz the Invader",
    description:
      "A brutal Ork warboss known for his brutal conquests and relentless pursuit of victory. Armed with a mega-shoota and mounted on a heavily-armed warbuggy, he is a force to be reckoned with on the battlefield.",
    type: MiniatureType.CHARACTER,
    size: { x: 2, y: 2, z: 3 },
    position: [0, 0],
    bearing: 0,
    speed: 14,
    meleeAttack: 3,
    rangeAttack: 3,
    armour: 3,
    hitpoints: 18,
    weapons: [
      {
        name: "Mega-Shoota",
        description:
          "A massive, rapid-fire gun that can spew out a barrage of bullets in a short amount of time.",
        damage: 4,
        range: 12,
      },
    ],
  },
  {
    name: "Krog the Despoiler",
    description:
      "A hulking brute of an Ork, Krog is feared throughout the galaxy for his brutal tactics and utter disregard for life.",
    type: MiniatureType.CHARACTER,
    size: { x: 1, y: 2, z: 1.5 },
    position: [0, 0],
    bearing: 0,
    speed: 5,
    meleeAttack: 5,
    rangeAttack: 0,
    armour: 3,
    hitpoints: 17,
    weapons: [
      {
        name: "Choppa",
        description:
          "A massive, jagged blade that Krog wields with deadly precision.",
        damage: 3,
        range: 1,
      },
      {
        name: "Big Shoota",
        description:
          "A heavy, mounted gun that Krog can use to mow down his enemies.",
        damage: 5,
        range: 15,
      },
    ],
  },
];
