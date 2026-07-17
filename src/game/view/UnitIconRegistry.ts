import { UNIT_CATALOG } from "../army/catalog";
import { MiniatureType } from "../classes/Miniature";

const FALLBACK_ICONS = [
  { id: "unit-character", url: "assets/character.png" },
  { id: "unit-vehicle", url: "assets/vehicle.png" },
  { id: "unit-infantry", url: "assets/infantry.png" },
] as const;

const CATALOG_ICONS = UNIT_CATALOG.flatMap((entry) =>
  entry.template.image
    ? [{ id: `unit-${entry.id}`, url: entry.template.image }]
    : []
);

export const UNIT_ICONS = [...FALLBACK_ICONS, ...CATALOG_ICONS].filter(
  (icon, index, icons) => icons.findIndex((candidate) => candidate.id === icon.id) === index
);

const CATALOG_ICON_BY_IMAGE = new Map(
  CATALOG_ICONS.map((icon) => [icon.url, icon.id])
);

export function getUnitIconId(
  image: string | undefined,
  type: MiniatureType
): string {
  if (image) {
    const catalogIcon = CATALOG_ICON_BY_IMAGE.get(image);
    if (catalogIcon) return catalogIcon;
  }
  if (type === MiniatureType.CHARACTER) return "unit-character";
  if (type === MiniatureType.VEHICLE) return "unit-vehicle";
  return "unit-infantry";
}
