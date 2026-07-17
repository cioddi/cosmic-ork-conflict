import { act, fireEvent, render, screen } from "@testing-library/react";
import { GameProvider, useGame } from "./GameContext";
import {
  GameWorld,
  LocalProjection,
  WorldDefinition,
  WorldPoint,
  WorldPolygon,
  worldBoundsForPoints,
} from "./world";
import { createArmy, setArmyUnitCount, UNIT_CATALOG } from "./army";

const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (
      typeof message === "string" &&
      message.includes("ReactDOMTestUtils.act")
    ) {
      return;
    }
    originalConsoleError(message, ...args);
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  jest.useRealTimers();
});

function polygon(id: string, points: WorldPoint[]): WorldPolygon {
  return { id, outer: points, holes: [], bounds: worldBoundsForPoints(points) };
}

function createOpenWorld(): GameWorld {
  const geographicArea = {
    outer: [
      [-0.002, -0.002],
      [0.002, -0.002],
      [0.002, 0.002],
      [-0.002, 0.002],
    ],
  } as const;
  const definition: WorldDefinition = {
    id: "game-provider-fixture",
    version: "1",
    playableArea: geographicArea,
    setupAreas: [geographicArea, geographicArea],
    routingPaddingMeters: 0,
    navigationCellSizeMeters: 8,
    spatialIndexCellSizeMeters: 40,
    mobilityProfiles: [
      { id: "infantry", clearanceMeters: 0.75 },
      { id: "vehicle", clearanceMeters: 1.5 },
    ],
    tileSource: { urlTemplate: "fixture", sourceLayer: "building", zoom: 1 },
  };
  const playable = polygon("playable", [
    [-200, -200],
    [200, -200],
    [200, 200],
    [-200, 200],
  ]);
  const playerOneSetup = polygon("player-one", [
    [-180, -180],
    [-20, -180],
    [-20, 180],
    [-180, 180],
  ]);
  const playerTwoSetup = polygon("player-two", [
    [20, -180],
    [180, -180],
    [180, 180],
    [20, 180],
  ]);
  return new GameWorld({
    definition,
    projection: new LocalProjection([0, 0]),
    routingBounds: playable.bounds,
    playableArea: playable,
    setupAreas: [playerOneSetup, playerTwoSetup],
    obstacles: [],
  });
}

function ReadinessProbe() {
  const state = useGame();
  const firstArmy = setArmyUnitCount(
    createArmy("First", new Date(0), "first"),
    UNIT_CATALOG[0].id,
    1,
    new Date(0)
  );
  const secondArmy = setArmyUnitCount(
    createArmy("Second", new Date(0), "second"),
    UNIT_CATALOG[1].id,
    1,
    new Date(0)
  );
  return (
    <>
      <output data-testid="status">{state?.status}</output>
      <output data-testid="tick">{state?.snapshot?.tick ?? -1}</output>
      <button type="button" onClick={() => state?.setViewReady(true)}>
        ready
      </button>
      <button
        type="button"
        onClick={() => state?.startBattle({ first: firstArmy, second: secondArmy })}
      >
        battle
      </button>
    </>
  );
}

test("the simulation remains at tick zero until the view reports readiness", async () => {
  jest.useFakeTimers();
  const world = createOpenWorld();

  render(
    <GameProvider loadWorld={() => Promise.resolve(world)}>
      <ReadinessProbe />
    </GameProvider>
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(screen.getByTestId("status")).toHaveTextContent("army-selection");
  fireEvent.click(screen.getByRole("button", { name: "battle" }));
  expect(screen.getByTestId("status")).toHaveTextContent("preparing-view");
  expect(screen.getByTestId("tick")).toHaveTextContent("0");
  act(() => jest.advanceTimersByTime(2_000));
  expect(screen.getByTestId("tick")).toHaveTextContent("0");

  fireEvent.click(screen.getByRole("button", { name: "ready" }));
  expect(screen.getByTestId("status")).toHaveTextContent("running");
  act(() => jest.advanceTimersByTime(649));
  expect(screen.getByTestId("tick")).toHaveTextContent("0");
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByTestId("tick")).toHaveTextContent("1");

});
