import { MiniatureOptions, MiniatureType } from "./classes/Miniature";

export type UnitAppearance = Pick<MiniatureOptions, "image" | "type">;

const DEFAULT_IMAGE_BY_TYPE: Readonly<Record<MiniatureType, string>> = {
  [MiniatureType.CHARACTER]: "assets/character.png",
  [MiniatureType.VEHICLE]: "assets/vehicle.png",
  [MiniatureType.ROBOT]: "assets/vehicle.png",
  [MiniatureType.INFANTRY]: "assets/infantry.png",
};

/** The single source of truth for catalogue, map, and interface unit artwork. */
export function getUnitImageSrc(unit: UnitAppearance): string {
  return unit.image ?? DEFAULT_IMAGE_BY_TYPE[unit.type];
}
