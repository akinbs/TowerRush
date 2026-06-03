import { UI_CONFIG } from "./uiConfig";

// Game-feel FX parameters. All effects are built from primitive Phaser
// GameObjects (Arc / Triangle) + tweens — no textures, atlases, particle JSON,
// or network requests, so the YouTube Playables bundle stays small.
//
// Colors are plain number[] (not `as const`) so Phaser.Utils.Array.GetRandom
// accepts them without a readonly-array type error.

export const FX_CONFIG = {
  // Depth band for world-space FX: above gameplay (platforms/player at depth 0),
  // below the HUD (90) and the end-of-run overlays.
  depth: 50,

  // Small icy puff kicked up on jump.
  jumpPuff: {
    count: 5,
    colors: [0xffffff, 0xcceeff, 0xaad8ff],
    minRadius: 2,
    maxRadius: 4,
    alpha: 0.85,
    spreadX: 14,
    minRise: 6,
    maxRise: 16,
    minDurationMs: 160,
    maxDurationMs: 240,
  },

  // Puff on landing; particle count scales with impact speed.
  landPuff: {
    minCount: 4,
    maxCount: 8,
    colors: [0xffffff, 0xcceeff, 0xbfe6ff],
    minRadius: 2,
    maxRadius: 5,
    alpha: 0.9,
    spreadX: 26,
    minRise: 4,
    maxRise: 12,
    minDurationMs: 160,
    maxDurationMs: 250,
    // Impact velocity (px/s) that maps to maxCount particles.
    intensityRefVelocity: 800,
  },

  // Ice shards thrown out when a breakable platform shatters.
  iceBreak: {
    minCount: 6,
    maxCount: 10,
    colors: [0xeaf6ff, 0xbfe6ff, 0x88c8f0],
    minSize: 4,
    maxSize: 8,
    alpha: 0.95,
    spreadX: 40,
    minFall: 20,
    maxFall: 70,
    minDurationMs: 320,
    maxDurationMs: 480,
  },

  // Tiny flecks the moment a breakable starts cracking (first contact).
  crackPulse: {
    count: 3,
    colors: [0xffffff, 0xd8f0ff],
    minRadius: 1,
    maxRadius: 3,
    alpha: 0.8,
    spreadX: 10,
    minRise: 6,
    maxRise: 14,
    minDurationMs: 120,
    maxDurationMs: 180,
  },

  // Non-fatal hard landing: impact velocity (px/s) above which a tiny shake fires.
  hardLandingVelocityY: 560,
  // Velocity that maps to the max hard-landing shake intensity.
  hardLandingMaxVelocityY: 900,

  // Camera shake amounts (Phaser shake intensity is a fraction of viewport).
  shake: {
    hardLanding: { durationMs: 80, minIntensity: 0.002, maxIntensity: 0.004 },
    gameOver:    { durationMs: 180, intensity: 0.008 },
  },

  // Expanding ring burst on tower completion. Depth sits at the overlay layer so
  // it reads over the dimmed background (added later → renders above it) but
  // under the overlay text (depth+1).
  towerCompletePulse: {
    depth: UI_CONFIG.towerCompleteDepth,
    color: 0xaef0ff,
    ringCount: 2,
    lineWidth: 3,
    startRadius: 18,
    endScale: 6,
    ringDelayMs: 120,
    durationMs: 560,
  },
};
