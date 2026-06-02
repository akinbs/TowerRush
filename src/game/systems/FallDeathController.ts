import type { Player } from "../entities/Player";
import type { DeathReason } from "../types/gameTypes";
import {
  FALL_DEATH_DISTANCE_METERS,
  FALL_WARNING_DISTANCE_METERS,
  MIN_HEIGHT_FOR_FALL_DEATH_METERS,
  GROUND_SURFACE_Y,
  PIXELS_PER_METER,
} from "../utils/constants";

export class FallDeathController {
  // Highest Y position the player has reached (lower Y = higher in the world).
  private peakY = GROUND_SURFACE_Y;

  reset(): void {
    this.peakY = GROUND_SURFACE_Y;
  }

  update(player: Player): void {
    const y = player.getY();
    if (y < this.peakY) {
      this.peakY = y;
    }
  }

  // Returns a DeathReason if the player should die this frame, null otherwise.
  checkDeath(player: Player): DeathReason | null {
    if (!player.isFalling()) return null;

    const peakHeightMeters = (GROUND_SURFACE_Y - this.peakY) / PIXELS_PER_METER;
    if (peakHeightMeters < MIN_HEIGHT_FOR_FALL_DEATH_METERS) return null;

    const fallMeters = (player.getY() - this.peakY) / PIXELS_PER_METER;
    if (fallMeters >= FALL_DEATH_DISTANCE_METERS) {
      return "fall_distance";
    }

    return null;
  }

  // Returns true when the player is in the warning zone (not yet dead).
  isInWarningZone(player: Player): boolean {
    if (!player.isFalling()) return false;

    const peakHeightMeters = (GROUND_SURFACE_Y - this.peakY) / PIXELS_PER_METER;
    if (peakHeightMeters < MIN_HEIGHT_FOR_FALL_DEATH_METERS) return false;

    const fallMeters = (player.getY() - this.peakY) / PIXELS_PER_METER;
    return fallMeters >= FALL_WARNING_DISTANCE_METERS && fallMeters < FALL_DEATH_DISTANCE_METERS;
  }

  getPeakY(): number { return this.peakY; }
}
