import { PLATFORM_HEIGHT } from "../utils/constants";

// ── Ice Tower Summit / Goal ────────────────────────────────────────────────
//
// Platform-type difficulty gating now lives in difficultyConfig.ts (warmup +
// weighted mix). This file only keeps the summit/goal constants, which the
// PlatformManager (goal placement) and PreloadScene (goal texture) depend on.

// Total climb height (m) at which the Ice Tower is completed. The goal platform
// is generated at — or as close as reachability allows to — this height. Lower
// this during development for faster end-to-end testing.
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
