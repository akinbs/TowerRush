import { GROUND_SURFACE_Y, PIXELS_PER_METER } from "./constants";

// Converts a world Y coordinate to a height in whole meters above the ground.
// Lower Y values (higher in the world) produce larger meter values.
export function getHeightMetersFromY(y: number): number {
  return Math.floor(Math.max(0, GROUND_SURFACE_Y - y) / PIXELS_PER_METER);
}

// Inverse of getHeightMetersFromY: converts a height in meters above the
// ground to the world Y coordinate that sits at that height. Used to place
// the goal platform at an exact summit height.
export function getYFromHeightMeters(heightMeters: number): number {
  return GROUND_SURFACE_Y - heightMeters * PIXELS_PER_METER;
}
