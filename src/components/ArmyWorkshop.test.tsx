import { fireEvent, render, screen } from "@testing-library/react";
import { ARMY_STORAGE_KEY, UNIT_CATALOG } from "../game/army";
import ArmyWorkshop from "./ArmyWorkshop";

beforeEach(() => window.localStorage.clear());

test("builds, saves, and reloads multiple local warbands", () => {
  render(<ArmyWorkshop />);

  fireEvent.click(screen.getByLabelText("Add Brog Ironfist"));
  const brogPoints = UNIT_CATALOG.find((entry) => entry.id === "brog-ironfist")!.points;
  expect(screen.getByText(`${brogPoints} / 500 pts`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save warband" }));

  expect(window.localStorage.getItem(ARMY_STORAGE_KEY)).toContain("New warband");
  expect(screen.getByText("Warband saved in this browser.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /New$/ }));
  expect(screen.getByLabelText("Warband name")).toHaveValue("New warband");
  expect(screen.getByText("0 / 500 pts")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /New warband.*1 units/i }));
  expect(screen.getByText(`${brogPoints} / 500 pts`)).toBeInTheDocument();
});

test("shows complete melee and ranged weapon profiles in the catalogue", () => {
  render(<ArmyWorkshop />);

  expect(
    screen.getByLabelText("Great Maul, damage 6, MELEE · ATK +5")
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Slingshot, damage 1, RNG 8m · HIT 4+")
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Power Klaw, damage 7, MELEE · ATK +6")
  ).toBeInTheDocument();
});
