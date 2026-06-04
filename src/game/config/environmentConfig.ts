// Parallax environment backdrop (UI Step 7). All layers are runtime-generated
// textures rendered behind gameplay — no external assets, ~0 bundle bytes.

// Render depths — all negative so the backdrop always sits behind platforms,
// player, hazards, snow (120), HUD (130) and overlays.
export const ENV_DEPTHS = {
  background: -100,
  aurora: -90,
  towerSilhouette: -80,
  nearMotes: -70,
} as const;

// Fraction of camera scrollY applied to each layer's tile offset — smaller =
// further away = drifts slower.
export const ENV_PARALLAX = {
  far: 0.08,
  mid: 0.18,
  near: 0.32,
} as const;

export const ENV_COLORS = {
  deepNavy: 0x071027,
  deepBlue: 0x0b1b3d,
  iceCyan: 0x48d5ff,
  auroraPurple: 0x9a7bff,
  auroraGreen: 0x5be6a8,
  frostWhite: 0xf4fbff,
} as const;

export const ENV_ATMOSPHERE = {
  // Height (m) over which the aurora warms/brightens toward the summit.
  heightTintStartMeters: 80,
  heightTintFullMeters: 240,
  baseAuroraAlpha: 0.1,
  maxAuroraAlpha: 0.22,
  wallAlpha: 0.5,
  moteAlpha: 0.55,
  // tilePositionX drift (ambient, scroll-independent) — px amplitude × sin(t).
  driftSpeed: 0.0005,
  auroraDriftAmp: 16,
  moteDriftAmp: 6,
  // Subtle warm tint mixed into the aurora near the summit.
  summitTint: 0xffe9c0,
  summitTintStrength: 0.6,
} as const;

export const ENV_LAYOUT = {
  wallWidth: 90,
  auroraTexW: 256,
  auroraTexH: 384,
  wallTexH: 256,
  moteTexSize: 256,
} as const;

// Frost specks drawn into one mote tile (kept low — the tile repeats across the
// screen, so this is per-256px, not per-screen).
export const ENV_MOTE_COUNT = 18;

// Generated-texture keys.
export const ENV_TEX = {
  gradient: "env-gradient",
  aurora: "env-aurora",
  wall: "env-wall",
  motes: "env-motes",
} as const;
