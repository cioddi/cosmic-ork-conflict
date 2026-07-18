import { UNIT_CATALOG } from "../army/catalog";
import { MiniatureType } from "../classes/Miniature";
import { getUnitImageSrc } from "../unitAppearance";

const FALLBACK_ICONS = [
  {
    id: "unit-character",
    url: getUnitImageSrc({ type: MiniatureType.CHARACTER }),
  },
  {
    id: "unit-vehicle",
    url: getUnitImageSrc({ type: MiniatureType.VEHICLE }),
  },
  {
    id: "unit-infantry",
    url: getUnitImageSrc({ type: MiniatureType.INFANTRY }),
  },
] as const;

const CATALOG_ICONS = UNIT_CATALOG.flatMap((entry) =>
  entry.template.image
    ? [{ id: `unit-${entry.id}`, url: entry.template.image }]
    : []
);

export const UNIT_ICONS = [...FALLBACK_ICONS, ...CATALOG_ICONS].filter(
  (icon, index, icons) =>
    icons.findIndex((candidate) => candidate.url === icon.url) === index
);

const ICON_ID_BY_IMAGE = new Map(
  UNIT_ICONS.map((icon) => [icon.url, icon.id])
);

export function getUnitIconId(
  image: string | undefined,
  type: MiniatureType
): string {
  const resolvedImage = getUnitImageSrc({ image, type });
  const fallbackImage = getUnitImageSrc({ type });
  return (
    ICON_ID_BY_IMAGE.get(resolvedImage) ??
    ICON_ID_BY_IMAGE.get(fallbackImage) ??
    "unit-infantry"
  );
}
