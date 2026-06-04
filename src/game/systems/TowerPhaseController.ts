import type { PlatformType } from "../types/gameTypes";
import {
  GAMEPLAY_WARMUP_END_METERS,
  MAX_CONSECUTIVE_BREAKABLE,
  MAX_CONSECUTIVE_MOVING,
  MAX_CONSECUTIVE_SLIPPERY,
  PHASE_LABEL_MIXED,
  PHASE_LABEL_SUMMIT,
  PHASE_LABEL_WARMUP,
  POST_WARMUP_FULL_MIX_HEIGHT_METERS,
  POST_WARMUP_FULL_WEIGHTS,
  POST_WARMUP_START_WEIGHTS,
  type PlatformTypeWeights,
} from "../config/difficultyConfig";
import {
  ICE_TOWER_GOAL_SAFE_MARGIN_METERS,
  ICE_TOWER_HEIGHT_METERS,
} from "../config/towerPhaseConfig";
import { getHeightMetersFromY } from "../utils/heightUtils";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Drives the HUD phase label and resolves platform types.
//
// Difficulty is no longer phase-gated per feature: below the warmup height only
// normal platforms appear; at and above it every type can mix via a height-
// ramped weighted roll, bounded by per-type consecutive caps. The goal platform
// is never rolled here — the summit logic places it.
export class TowerPhaseController {
  private phaseName = PHASE_LABEL_WARMUP;

  private consecutiveSlipperyCount = 0;
  private consecutiveBreakableCount = 0;
  private consecutiveMovingCount = 0;

  // Call every frame with the player's current height to update the phase label.
  update(heightMeters: number): void {
    if (heightMeters >= ICE_TOWER_HEIGHT_METERS - ICE_TOWER_GOAL_SAFE_MARGIN_METERS) {
      this.phaseName = PHASE_LABEL_SUMMIT;
    } else if (heightMeters >= GAMEPLAY_WARMUP_END_METERS) {
      this.phaseName = PHASE_LABEL_MIXED;
    } else {
      this.phaseName = PHASE_LABEL_WARMUP;
    }
  }

  getCurrentPhaseName(): string {
    return this.phaseName;
  }

  // ── Platform type resolution ───────────────────────────────────────────

  // Resolves the platform type for a world-Y coordinate.
  choosePlatformType(platformY: number): PlatformType {
    const heightMeters = getHeightMetersFromY(platformY);

    // Warmup: only normal platforms (also resets consecutive counters).
    if (heightMeters < GAMEPLAY_WARMUP_END_METERS) {
      return this.commitType("normal");
    }

    const weights = this.currentWeights(heightMeters);
    const rolled = this.rollWeighted(weights);
    return this.commitType(this.applyConsecutiveCaps(rolled));
  }

  reset(): void {
    this.phaseName = PHASE_LABEL_WARMUP;
    this.consecutiveSlipperyCount = 0;
    this.consecutiveBreakableCount = 0;
    this.consecutiveMovingCount = 0;
  }

  // ── Private ────────────────────────────────────────────────────────────

  // Interpolates the selection weights from START (at warmup end) to FULL.
  private currentWeights(heightMeters: number): PlatformTypeWeights {
    const span = POST_WARMUP_FULL_MIX_HEIGHT_METERS - GAMEPLAY_WARMUP_END_METERS;
    const t = clamp01((heightMeters - GAMEPLAY_WARMUP_END_METERS) / span);
    return {
      normal: lerp(POST_WARMUP_START_WEIGHTS.normal, POST_WARMUP_FULL_WEIGHTS.normal, t),
      slippery: lerp(POST_WARMUP_START_WEIGHTS.slippery, POST_WARMUP_FULL_WEIGHTS.slippery, t),
      breakable: lerp(POST_WARMUP_START_WEIGHTS.breakable, POST_WARMUP_FULL_WEIGHTS.breakable, t),
      moving: lerp(POST_WARMUP_START_WEIGHTS.moving, POST_WARMUP_FULL_WEIGHTS.moving, t),
    };
  }

  private rollWeighted(w: PlatformTypeWeights): PlatformType {
    const total = w.normal + w.slippery + w.breakable + w.moving;
    let roll = Math.random() * total;
    if ((roll -= w.slippery) < 0) return "slippery";
    if ((roll -= w.breakable) < 0) return "breakable";
    if ((roll -= w.moving) < 0) return "moving";
    return "normal";
  }

  // Forces a normal platform when the same special type would exceed its cap.
  private applyConsecutiveCaps(type: PlatformType): PlatformType {
    if (type === "moving" && this.consecutiveMovingCount >= MAX_CONSECUTIVE_MOVING) return "normal";
    if (type === "breakable" && this.consecutiveBreakableCount >= MAX_CONSECUTIVE_BREAKABLE) return "normal";
    if (type === "slippery" && this.consecutiveSlipperyCount >= MAX_CONSECUTIVE_SLIPPERY) return "normal";
    return type;
  }

  // Updates the consecutive counters and returns the committed type.
  private commitType(type: PlatformType): PlatformType {
    this.consecutiveMovingCount = type === "moving" ? this.consecutiveMovingCount + 1 : 0;
    this.consecutiveBreakableCount = type === "breakable" ? this.consecutiveBreakableCount + 1 : 0;
    this.consecutiveSlipperyCount = type === "slippery" ? this.consecutiveSlipperyCount + 1 : 0;
    return type;
  }
}
