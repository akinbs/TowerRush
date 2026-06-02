import type { PlatformType } from "../types/gameTypes";
import {
  ICE_BREAKABLE_MAX_CHANCE,
  ICE_BREAKABLE_MIN_CHANCE,
  ICE_MAX_CONSECUTIVE_BREAKABLE,
  ICE_MAX_CONSECUTIVE_MOVING,
  ICE_MAX_CONSECUTIVE_SLIPPERY,
  ICE_MOVING_MAX_CHANCE,
  ICE_MOVING_MIN_CHANCE,
  ICE_PHASE_BREAKABLE_FULL_METERS,
  ICE_PHASE_BREAKABLE_START_METERS,
  ICE_PHASE_LABEL_CRACKING,
  ICE_PHASE_LABEL_MOVING,
  ICE_PHASE_LABEL_NORMAL,
  ICE_PHASE_LABEL_SLIPPERY,
  ICE_PHASE_LABEL_SUMMIT,
  ICE_PHASE_MOVING_FULL_METERS,
  ICE_PHASE_MOVING_START_METERS,
  ICE_PHASE_NORMAL_END_METERS,
  ICE_PHASE_SLIPPERY_FULL_METERS,
  ICE_SLIPPERY_MAX_CHANCE,
  ICE_SLIPPERY_MIN_CHANCE,
  ICE_TOWER_GOAL_SAFE_MARGIN_METERS,
  ICE_TOWER_HEIGHT_METERS,
} from "../config/towerPhaseConfig";
import { getHeightMetersFromY } from "../utils/heightUtils";

// Combined special-type chance never exceeds this value.
const MAX_COMBINED_SPECIAL_CHANCE = 0.65;

export class TowerPhaseController {
  private phaseName = ICE_PHASE_LABEL_NORMAL;

  private consecutiveSlipperyCount = 0;
  private consecutiveBreakableCount = 0;
  private consecutiveMovingCount = 0;

  // Call every frame with the player's current height to update the phase label.
  update(heightMeters: number): void {
    if (heightMeters >= ICE_TOWER_HEIGHT_METERS - ICE_TOWER_GOAL_SAFE_MARGIN_METERS) {
      this.phaseName = ICE_PHASE_LABEL_SUMMIT;
    } else if (heightMeters >= ICE_PHASE_MOVING_START_METERS) {
      this.phaseName = ICE_PHASE_LABEL_MOVING;
    } else if (heightMeters >= ICE_PHASE_BREAKABLE_START_METERS) {
      this.phaseName = ICE_PHASE_LABEL_CRACKING;
    } else if (heightMeters >= ICE_PHASE_NORMAL_END_METERS) {
      this.phaseName = ICE_PHASE_LABEL_SLIPPERY;
    } else {
      this.phaseName = ICE_PHASE_LABEL_NORMAL;
    }
  }

  getCurrentPhaseName(): string {
    return this.phaseName;
  }

  // ── Chance functions ───────────────────────────────────────────────────

  getSlipperyChance(heightMeters: number): number {
    if (heightMeters < ICE_PHASE_NORMAL_END_METERS) return 0;
    if (heightMeters >= ICE_PHASE_SLIPPERY_FULL_METERS) return ICE_SLIPPERY_MAX_CHANCE;
    const t =
      (heightMeters - ICE_PHASE_NORMAL_END_METERS) /
      (ICE_PHASE_SLIPPERY_FULL_METERS - ICE_PHASE_NORMAL_END_METERS);
    return ICE_SLIPPERY_MIN_CHANCE + t * (ICE_SLIPPERY_MAX_CHANCE - ICE_SLIPPERY_MIN_CHANCE);
  }

  getBreakableChance(heightMeters: number): number {
    if (heightMeters < ICE_PHASE_BREAKABLE_START_METERS) return 0;
    if (heightMeters >= ICE_PHASE_BREAKABLE_FULL_METERS) return ICE_BREAKABLE_MAX_CHANCE;
    const t =
      (heightMeters - ICE_PHASE_BREAKABLE_START_METERS) /
      (ICE_PHASE_BREAKABLE_FULL_METERS - ICE_PHASE_BREAKABLE_START_METERS);
    return ICE_BREAKABLE_MIN_CHANCE + t * (ICE_BREAKABLE_MAX_CHANCE - ICE_BREAKABLE_MIN_CHANCE);
  }

  getMovingChance(heightMeters: number): number {
    if (heightMeters < ICE_PHASE_MOVING_START_METERS) return 0;
    if (heightMeters >= ICE_PHASE_MOVING_FULL_METERS) return ICE_MOVING_MAX_CHANCE;
    const t =
      (heightMeters - ICE_PHASE_MOVING_START_METERS) /
      (ICE_PHASE_MOVING_FULL_METERS - ICE_PHASE_MOVING_START_METERS);
    return ICE_MOVING_MIN_CHANCE + t * (ICE_MOVING_MAX_CHANCE - ICE_MOVING_MIN_CHANCE);
  }

  // ── Platform type resolution ───────────────────────────────────────────

  // Resolves platform type for a world-Y coordinate.
  // Uses a single combined roll with proportional normalisation so the total
  // special-type chance never exceeds MAX_COMBINED_SPECIAL_CHANCE.
  choosePlatformType(platformY: number): PlatformType {
    const heightMeters = getHeightMetersFromY(platformY);

    const rawMoving   = this.getMovingChance(heightMeters);
    const rawBreakable = this.getBreakableChance(heightMeters);
    const rawSlippery  = this.getSlipperyChance(heightMeters);

    // Proportionally scale down if the combined chance exceeds the cap.
    const rawTotal = rawMoving + rawBreakable + rawSlippery;
    const scale    = rawTotal > MAX_COMBINED_SPECIAL_CHANCE
      ? MAX_COMBINED_SPECIAL_CHANCE / rawTotal
      : 1;

    const movingChance   = rawMoving   * scale;
    const breakableChance = rawBreakable * scale;
    const slipperyChance  = rawSlippery  * scale;

    const roll = Math.random();
    let type: PlatformType;

    if (roll < movingChance) {
      type = "moving";
    } else if (roll < movingChance + breakableChance) {
      type = "breakable";
    } else if (roll < movingChance + breakableChance + slipperyChance) {
      type = "slippery";
    } else {
      type = "normal";
    }

    // Enforce consecutive caps — fall back to normal when the cap is hit.
    if (type === "moving"    && this.consecutiveMovingCount    >= ICE_MAX_CONSECUTIVE_MOVING)   type = "normal";
    if (type === "breakable" && this.consecutiveBreakableCount >= ICE_MAX_CONSECUTIVE_BREAKABLE) type = "normal";
    if (type === "slippery"  && this.consecutiveSlipperyCount  >= ICE_MAX_CONSECUTIVE_SLIPPERY)  type = "normal";

    this.consecutiveMovingCount    = type === "moving"    ? this.consecutiveMovingCount    + 1 : 0;
    this.consecutiveBreakableCount = type === "breakable" ? this.consecutiveBreakableCount + 1 : 0;
    this.consecutiveSlipperyCount  = type === "slippery"  ? this.consecutiveSlipperyCount  + 1 : 0;

    return type;
  }

  reset(): void {
    this.phaseName = ICE_PHASE_LABEL_NORMAL;
    this.consecutiveSlipperyCount = 0;
    this.consecutiveBreakableCount = 0;
    this.consecutiveMovingCount = 0;
  }
}
