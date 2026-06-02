import type { PlatformGenerationConfig } from "../types/gameTypes";

export const PLATFORM_GEN_CONFIG: PlatformGenerationConfig = {
  initialPlatformCount: 18,

  // Generate platforms this far above the player to ensure the screen is
  // always populated before the player can reach empty space.
  generateAheadDistance: 900,

  // Destroy platforms this far below the camera's bottom edge.
  // Large enough to avoid popping during fast scroll-back, small enough to
  // keep the physics world lean.
  cleanupBelowDistance: 700,

  minVerticalGap: 95,
  maxVerticalGap: 145,

  minPlatformWidth: 100,
  maxPlatformWidth: 170,

  // Prevents platforms from spawning flush against the world edges.
  safeHorizontalPadding: 32,

  // If a valid reachable candidate isn't found within this many tries,
  // fall back to a clamped safe position.
  maxGenerationAttempts: 12,

  // Conservative multiplier so the reachability gate is meaningful even on
  // a narrow (400 px) world. 0.8 means we assume the player uses ~80% of
  // their theoretical air-time for horizontal movement.
  airControlMultiplier: 0.8,
};
