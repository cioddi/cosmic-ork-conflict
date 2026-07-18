import { UNIT_CATALOG, UNIT_CATALOG_BY_ID } from "./army";
import { getUnitImageSrc } from "./unitAppearance";
import { getUnitIconId, UNIT_ICONS } from "./view/UnitIconRegistry";

test("every catalogue unit resolves to the same image in the UI and map registry", () => {
  for (const entry of UNIT_CATALOG) {
    const imageUrl = getUnitImageSrc(entry.template);
    const iconId = getUnitIconId(entry.template.image, entry.template.type);
    const registeredIcon = UNIT_ICONS.find((icon) => icon.id === iconId);

    expect(registeredIcon?.url, entry.template.name).toBe(imageUrl);
  }
});

test("Rivetclaw Walker consistently uses the vehicle fallback image", () => {
  const dread = UNIT_CATALOG_BY_ID.get("deff-dread")!;
  const imageUrl = getUnitImageSrc(dread.template);
  const iconId = getUnitIconId(dread.template.image, dread.template.type);

  expect(imageUrl).toBe("assets/vehicle.png");
  expect(UNIT_ICONS.find((icon) => icon.id === iconId)?.url).toBe(imageUrl);
});
