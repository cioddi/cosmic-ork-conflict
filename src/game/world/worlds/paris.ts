import { GeographicPolygon, WorldDefinition } from "../types";

export const PARIS_SETUP_AREAS: readonly GeographicPolygon[] = [
  {
    outer: [
      [2.3100715332713833, 48.85097657043505],
      [2.328249799962066, 48.85365591032402],
      [2.3309401834327446, 48.8503067130581],
      [2.310289672471839, 48.846957291748225],
    ],
  },
  {
    outer: [
      [2.3163248570122335, 48.83690728604532],
      [2.3378479247763266, 48.840256647415714],
      [2.3388659077103, 48.83662030670902],
      [2.3182153967493946, 48.833270885399145],
    ],
  },
];

export const PARIS_WORLD_DEFINITION: WorldDefinition = {
  id: "paris-montsouris",
  version: "1",
  playableArea: {
    outer: [
      [2.308, 48.8315],
      [2.341, 48.8315],
      [2.341, 48.856],
      [2.308, 48.856],
    ],
  },
  setupAreas: PARIS_SETUP_AREAS,
  // Covers path smoothing near the play edge without pulling in a third tile column.
  routingPaddingMeters: 48,
  navigationCellSizeMeters: 8,
  spatialIndexCellSizeMeters: 80,
  mobilityProfiles: [
    { id: "infantry", clearanceMeters: 0.75 },
    { id: "vehicle", clearanceMeters: 1.5 },
  ],
  tileSource: {
    urlTemplate:
      "https://wms.wheregroup.com/tileserver/tile/world-0-14/{z}/{x}/{y}.pbf",
    sourceLayer: "building",
    zoom: 14,
    maxConcurrentRequests: 6,
    retryCount: 2,
  },
};
