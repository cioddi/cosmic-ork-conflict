import { render, screen } from "@testing-library/react";
import { UNIT_CATALOG } from "../game/army";
import { MiniatureGeoJsonFeature } from "../game/view/MapLibreSnapshotAdapter";
import SelectedMiniatureStatsTable from "./SelectedMiniatureStatsTable";

test("shows the selected unit's complete weapon loadout", () => {
  const { position: _position, ...template } = UNIT_CATALOG[0].template;
  const miniature: MiniatureGeoJsonFeature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [2.3, 48.8] },
    properties: {
      ...template,
      id: "selected-unit",
      playerId: 1,
      damageDealt: 12,
      killCount: 2,
      unitsKilled: [],
      initialHitpoints: template.hitpoints,
    },
  };

  render(<SelectedMiniatureStatsTable miniature={miniature} />);

  expect(screen.getByLabelText("Brog Ironfist weapons")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Great Maul, damage 6, MELEE · ATK +5")
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Brass Knuckles, damage 3, MELEE · ATK +5")
  ).toBeInTheDocument();
});
