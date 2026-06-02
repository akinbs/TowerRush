import { PLATFORM_HEIGHT } from "../utils/constants";

// ── Ice Tower Phase Thresholds ─────────────────────────────────────────────

// Below this height: only normal platforms (Phase 0).
export const ICE_PHASE_NORMAL_END_METERS = 20;

// Above this height: slippery chance is at maximum (Phase 1 fully active).
export const ICE_PHASE_SLIPPERY_FULL_METERS = 60;

// ── Slippery Platform Chance ───────────────────────────────────────────────

// Slippery chance at the start of the transition zone (20–60 m).
export const ICE_SLIPPERY_MIN_CHANCE = 0.10;

// Slippery chance once fully in Phase 1 (≥ 60 m).
export const ICE_SLIPPERY_MAX_CHANCE = 0.35;

// Maximum consecutive slippery platforms before forcing a normal one.
export const ICE_MAX_CONSECUTIVE_SLIPPERY = 2;

// ── Phase 2: Cracking Ice (breakable platforms) ────────────────────────────

// Below this height: no breakable platforms.
export const ICE_PHASE_BREAKABLE_START_METERS = 80;

// Above this height: breakable chance is at maximum.
export const ICE_PHASE_BREAKABLE_FULL_METERS = 140;

// Breakable chance at the start of Phase 2 (80–140 m).
export const ICE_BREAKABLE_MIN_CHANCE = 0.08;

// Breakable chance once fully in Phase 2 (≥ 140 m).
export const ICE_BREAKABLE_MAX_CHANCE = 0.25;

// Maximum consecutive breakable platforms before forcing a non-breakable one.
export const ICE_MAX_CONSECUTIVE_BREAKABLE = 1;

// ── Phase 3: Moving Ice ────────────────────────────────────────────────────

// Below this height: no moving platforms.
export const ICE_PHASE_MOVING_START_METERS = 140;

// Above this height: moving chance is at maximum.
export const ICE_PHASE_MOVING_FULL_METERS = 220;

// Moving chance at the start of Phase 3 (140–220 m).
export const ICE_MOVING_MIN_CHANCE = 0.06;

// Moving chance once fully in Phase 3 (≥ 220 m).
export const ICE_MOVING_MAX_CHANCE = 0.22;

// Maximum consecutive moving platforms before forcing a non-moving one.
export const ICE_MAX_CONSECUTIVE_MOVING = 1;

// ── Phase Display Labels ───────────────────────────────────────────────────

export const ICE_PHASE_LABEL_NORMAL   = "Normal Ice";
export const ICE_PHASE_LABEL_SLIPPERY = "Slippery Ice";
export const ICE_PHASE_LABEL_CRACKING = "Cracking Ice";
export const ICE_PHASE_LABEL_MOVING   = "Moving Ice";
export const ICE_PHASE_LABEL_SUMMIT   = "Summit";

// ── Ice Tower Summit / Goal ────────────────────────────────────────────────

// Total climb height (m) at which the Ice Tower is completed. The goal
// platform is generated at — or as close as reachability allows to — this
// height. Lower this during development for faster end-to-end testing.
export const ICE_TOWER_HEIGHT_METERS = 260;

// Goal platform is intentionally wider than normal platforms so the final
// landing is forgiving and visually reads as a destination.
export const ICE_TOWER_GOAL_PLATFORM_WIDTH = 240;

// Goal platform shares the normal platform body height so collision physics
// stay identical to every other surface the player has stood on.
export const ICE_TOWER_GOAL_PLATFORM_HEIGHT = PLATFORM_HEIGHT;

// Within this many meters of the summit the HUD phase label switches to
// "Summit", signalling the climb is almost over.
export const ICE_TOWER_GOAL_SAFE_MARGIN_METERS = 5;
