// Snow Time visual + gameplay configuration (Step 14).
//
// Snow is built entirely from primitive Phaser shapes (screen-space circles for
// flakes, world-space rectangles for platform caps) — no textures, atlases, or
// network. All magic numbers live here.

export const SNOW_CONFIG = {
  particle: {
    // Falling-flake counts. Mobile uses fewer for performance.
    countDesktop: 110,
    countMobile: 70,
    // Below this scene width we treat the device as mobile.
    mobileWidthThreshold: 500,

    minRadius: 1,
    maxRadius: 3,
    // Downward fall speed range (px/s). Smaller flakes tend faster (parallax).
    minSpeedY: 45,
    maxSpeedY: 135,
    // Constant horizontal drift range (px/s).
    minDriftX: -35,
    maxDriftX: 35,
    // Sinusoidal wind sway layered on top of the drift.
    swayAmplitude: 18,
    swaySpeed: 0.0015,
    // Per-flake alpha range for depth variety.
    minAlpha: 0.35,
    maxAlpha: 0.9,
    // Screen-space depth (above gameplay; below end-of-run overlays at 150+).
    depth: 120,
  },

  cap: {
    // Snow cap overlay sitting on top of a platform.
    depthOffset: 2,   // renders just above the platform (depth 0)
    height: 5,
    alpha: 0.9,
    color: 0xffffff,
    // Cap is inset slightly from the platform width so it reads as a layer.
    widthInset: 4,
    // Slow, soft melt when snow ends — snow lingers on the ground after the
    // storm passes (longer than the flake fade on purpose).
    fadeOutMs: 3500,
  },

  player: {
    // Applied while snow is active. Jump barely changes so platforms stay
    // reachable; horizontal control is what gets noticeably heavier.
    speedMultiplier: 0.62,
    accelerationMultiplier: 0.55, // slows slippery lerp acceleration
    jumpMultiplier: 0.95,
    frictionMultiplier: 0.92,     // slightly heavier stop on normal ground
  },

  // Flake fade-out duration (ms) after snow_end before particles are destroyed.
  endFadeMs: 900,

  // Hailstones mixed INTO the snowfall (Step 14.3): bigger world-space ice balls
  // that bounce, knock the player back (never kill), and shatter after one hit.
  hail: {
    enabled: true,

    // Roughly this fraction of the flake count becomes the live-hail cap.
    toSnowRatio: 0.20,
    // Per-device hard cap on simultaneously live hailstones.
    maxActiveDesktop: 20,
    maxActiveMobile: 12,

    // Clusters of 1–3 drop together at random intervals while snow is active.
    clusterMinCount: 1,
    clusterMaxCount: 3,
    clusterMinIntervalMs: 450,
    clusterMaxIntervalMs: 1100,

    // Integer radii — one tiny texture is generated per radius so the circle
    // body always matches the sprite (no scale/center mismatch).
    radiusMin: 4,
    radiusMax: 7,

    // Net downward gravity (px/s²); body offsets DEFAULT_GRAVITY like projectiles.
    gravityY: 650,
    bounce: 0.78,
    minVelocityX: -120,
    maxVelocityX: 120,
    minVelocityY: 120,
    maxVelocityY: 260,

    // Spawn just above the visible top so they fall into view.
    spawnAboveMinPx: 20,
    spawnAboveMaxPx: 120,
    // Cull margin past the viewport (> spawnAboveMax so fresh hail isn't culled).
    cleanupMargin: 150,

    // Knockback (lighter than projectiles).
    playerHitCooldownMs: 700,
    knockbackXMultiplier: 0.75,
    knockbackYMultiplier: 0.55,
    minKnockbackX: 160,
    maxKnockbackX: 460,
    maxKnockbackY: 380,
    controlLockMs: 150,
    knockbackDirVelocityThreshold: 30,

    // Shatter: break apart after this many platform bounces, or on a player hit.
    shatterAfterBounces: 1,
    shatterParticleMin: 4,
    shatterParticleMax: 8,
    shatterParticleLifetimeMs: 300,
    shatterParticleRadiusMin: 1,
    shatterParticleRadiusMax: 3,
    shatterSpreadX: 26,   // ± horizontal scatter
    shatterRiseY: 8,      // small upward kick
    shatterFallY: 30,     // mostly downward fall
    shatterColor: 0xddf2ff,

    // World-space depth (above FX/snow caps, below the projectile/HUD layers).
    depth: 65,
  },
};

