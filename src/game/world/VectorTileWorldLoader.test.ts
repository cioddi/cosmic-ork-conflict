import {
  VectorTileWorldLoader,
  renderTileUrl,
  tilesForBounds,
} from "./VectorTileWorldLoader";
import { TileFetcher, WorldDefinition } from "./types";

test("renders XYZ, TMS, and subdomain tile placeholders", () => {
  expect(
    renderTileUrl("https://{s}.example/{z}/{x}/{y}/{-y}.pbf", {
      z: 3,
      x: 4,
      y: 2,
    })
  ).toBe("https://a.example/3/4/2/5.pbf");
});

test("enumerates every tile intersecting bounds", () => {
  const tiles = tilesForBounds([2.31, 48.83, 2.34, 48.86], 14);
  expect(tiles.length).toBeGreaterThan(0);
  expect(new Set(tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`)).size).toBe(
    tiles.length
  );
});

test("fails closed when a required terrain tile remains unavailable", async () => {
  let attempts = 0;
  const fetcher: TileFetcher = {
    fetchTile: async () => {
      attempts++;
      throw new Error("offline");
    },
  };
  const area = {
    outer: [
      [2.32, 48.84],
      [2.321, 48.84],
      [2.321, 48.841],
      [2.32, 48.841],
    ],
  } as const;
  const definition: WorldDefinition = {
    id: "offline-fixture",
    version: "1",
    playableArea: area,
    setupAreas: [area],
    routingPaddingMeters: 0,
    navigationCellSizeMeters: 8,
    spatialIndexCellSizeMeters: 80,
    mobilityProfiles: [{ id: "infantry", clearanceMeters: 1 }],
    tileSource: {
      urlTemplate: "https://invalid/{z}/{x}/{y}.pbf",
      sourceLayer: "building",
      zoom: 14,
      retryCount: 1,
      maxConcurrentRequests: 1,
    },
  };
  await expect(new VectorTileWorldLoader(fetcher).load(definition)).rejects.toThrow(
    "Unable to load required world tile"
  );
  expect(attempts).toBe(2);
});
