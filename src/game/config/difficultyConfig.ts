import type { PlatformType } from "../types/gameTypes";

// Central difficulty gating (replaces the old per-feature phase thresholds).
//
// Model: a short warmup, then everything mixes. Below GAMEPLAY_WARMUP_END_METERS
// the run is a safe tutorial zone (only normal platforms, no projectile / snow
// hazards). At and above it, all platform types and hazards enter the pool.

// Climbed height (m) at which the warmup ends and the full feature mix begins.
export const GAMEPLAY_WARMUP_END_METERS = 30;

// Special-platform weights ramp from their START values (at the warmup end) to
// their FULL values at this height, so 30 m+ is immediately varied but eases in.
export const POST_WARMUP_FULL_MIX_HEIGHT_METERS = 80;

// Relative platform selection weights (goal is excluded — it is placed by the
// summit logic, never rolled). Values need not sum to 1; they are normalised.
export type PlatformTypeWeights = Record<Exclude<PlatformType, "goal">, number>;

// Weights right at the warmup end (30 m): specials are possible but lighter.
export const POST_WARMUP_START_WEIGHTS: PlatformTypeWeights = {
  normal: 0.65,
  slippery: 0.14,
  breakable: 0.11,
  moving: 0.10,
};

// Weights once fully mixed (>= POST_WARMUP_FULL_MIX_HEIGHT_METERS).
export const POST_WARMUP_FULL_WEIGHTS: PlatformTypeWeights = {
  normal: 0.45,
  slippery: 0.22,
  breakable: 0.18,
  moving: 0.15,
};

// Fairness: cap how many of the same special type can appear back-to-back.
// On hitting a cap the type falls back to normal.
export const MAX_CONSECUTIVE_SLIPPERY = 2;
export const MAX_CONSECUTIVE_BREAKABLE = 1;
export const MAX_CONSECUTIVE_MOVING = 1;

// HUD phase labels — information only; phase no longer gates platform types.
export const PHASE_LABEL_WARMUP = "Warmup";
export const PHASE_LABEL_MIXED = "Mixed Ice";
export const PHASE_LABEL_SUMMIT = "Summit";
