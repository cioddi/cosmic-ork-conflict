import { GeographicPoint, WorldPoint } from "./types";

const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * A local equirectangular projection centered on the game world.
 *
 * Game areas are only a few kilometers wide, so this gives stable meter units
 * without bringing renderer or map-projection concerns into the engine.
 */
export class LocalProjection {
  private readonly originLongitudeRadians: number;
  private readonly originLatitudeRadians: number;
  private readonly longitudeScale: number;

  constructor(public readonly origin: GeographicPoint) {
    this.originLongitudeRadians = degreesToRadians(origin[0]);
    this.originLatitudeRadians = degreesToRadians(origin[1]);
    this.longitudeScale = Math.cos(this.originLatitudeRadians);
  }

  project(point: GeographicPoint): WorldPoint {
    const longitude = degreesToRadians(point[0]);
    const latitude = degreesToRadians(point[1]);
    return [
      (longitude - this.originLongitudeRadians) *
        EARTH_RADIUS_METERS *
        this.longitudeScale,
      (latitude - this.originLatitudeRadians) * EARTH_RADIUS_METERS,
    ];
  }

  unproject(point: WorldPoint): GeographicPoint {
    const longitude =
      this.originLongitudeRadians +
      point[0] / (EARTH_RADIUS_METERS * this.longitudeScale);
    const latitude =
      this.originLatitudeRadians + point[1] / EARTH_RADIUS_METERS;
    return [radiansToDegrees(longitude), radiansToDegrees(latitude)];
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

