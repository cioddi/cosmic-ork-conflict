import { fireEvent, render, screen } from "@testing-library/react";
import { ARMY_STORAGE_KEY } from "../game/army";
import ArmyWorkshop from "./ArmyWorkshop";

beforeEach(() => window.localStorage.clear());

test("builds, saves, and reloads multiple local warbands", () => {
  render(<ArmyWorkshop />);

  fireEvent.click(screen.getByLabelText("Add Brog Ironfist"));
  expect(screen.getByText("110 / 500 pts")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save warband" }));

  expect(window.localStorage.getItem(ARMY_STORAGE_KEY)).toContain("New warband");
  expect(screen.getByText("Warband saved in this browser.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /New$/ }));
  expect(screen.getByLabelText("Warband name")).toHaveValue("New warband");
  expect(screen.getByText("0 / 500 pts")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /New warband.*1 units/i }));
  expect(screen.getByText("110 / 500 pts")).toBeInTheDocument();
});
