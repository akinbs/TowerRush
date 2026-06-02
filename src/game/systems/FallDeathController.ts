import type { Player } from "../entities/Player";
import type { DeathReason, ScoreSnapshot } from "../types/gameTypes";
import {
  FALL_DAMAGE_DEATH_DISTANCE_METERS,
  FALL_DAMAGE_MIN_HEIGHT_METERS,
  FALL_DAMAGE_MIN_VELOCITY_Y,
  FALL_DAMAGE_WARNING_DISTANCE_METERS,
  PIXELS_PER_METER,
} from "../utils/constants";

export class FallDeathController {
  // Lowest Y (= highest world position) the player reached in the current airborne phase.
  // null means the player is on the ground or just became airborne this frame.
  private peakAirY: number | null = null;

  // True once fall distance + velocity thresholds are both exceeded.
  // Stays true until landing (death) or scene restart (reset).
  private dangerousFallArmed = false;

  // Latched on the first frame dangerousFallArmed && isOnGround.
  private deathPending = false;

  private deathReason: DeathReason | null = null;
  private currentFallDistanceMeters = 0;

  reset(): void {
    this.peakAirY = null;
    this.dangerousFallArmed = false;
    this.deathPending = false;
    this.deathReason = null;
    this.currentFallDistanceMeters = 0;
  }

  update(player: Player, snapshot: ScoreSnapshot): void {
    if (this.deathPending) return;

    const isGrounded = player.isOnGround();
    const y = player.getY();
    const velocityY = player.getVelocityY();

    if (!isGrounded) {
      // Track the peak (highest point = smallest Y) of this airborne phase.
      if (this.peakAirY === null) {
        this.peakAirY = y;
      }
      this.peakAirY = Math.min(this.peakAirY, y);

      // Current fall distance measured from the peak of this airborne phase.
      const fallDistancePx = Math.max(0, y - this.peakAirY);
      this.currentFallDistanceMeters = fallDistancePx / PIXELS_PER_METER;

      // Arm dangerous fall when all three guards are met.
      if (
        !this.dangerousFallArmed &&
        snapshot.bestHeightMeters >= FALL_DAMAGE_MIN_HEIGHT_METERS &&
        this.currentFallDistanceMeters >= FALL_DAMAGE_DEATH_DISTANCE_METERS &&
        velocityY > FALL_DAMAGE_MIN_VELOCITY_Y
      ) {
        this.dangerousFallArmed = true;
      }
    }

    if (isGrounded) {
      if (this.dangerousFallArmed) {
        // Death on any landing after a dangerous fall — platform or ground, visible or not.
        this.deathPending = true;
        this.deathReason = "fall_damage_landing";
        return;
      }

      // Safe landing — reset airborne tracking for the next jump.
      this.peakAirY = null;
      this.currentFallDistanceMeters = 0;
      this.dangerousFallArmed = false;
    }
  }

  shouldTriggerDeath(): boolean {
    return this.deathPending;
  }

  getDeathReason(): DeathReason | null {
    return this.deathReason;
  }

  getFallDistanceMeters(): number {
    return this.currentFallDistanceMeters;
  }

  isDangerousFallArmed(): boolean {
    return this.dangerousFallArmed;
  }

  // True during the warning zone — fall is significant but not yet lethal.
  isWarning(): boolean {
    return (
      !this.dangerousFallArmed &&
      this.currentFallDistanceMeters >= FALL_DAMAGE_WARNING_DISTANCE_METERS
    );
  }
}
