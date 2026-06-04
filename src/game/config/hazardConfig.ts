import { DEFAULT_GRAVITY } from "../utils/constants";

// Central configuration for the competitive hazard systems.
//
// Step 12 added the scheduler (timing only). Step 13 fills in the side
// projectile physics/visuals. Snow timing stays here for Step 14. All magic
// numbers live here; no external assets are referenced.

export const HAZARD_CONFIG = {
  // Master switch — when false the scheduler is a no-op (events never fire).
  updateEnabled: true,

  // When snow is active, projectile scheduling is frozen so the two hazards
  // never stack into unfair difficulty.
  snowPausesProjectileHazards: true,

  sideProjectile: {
    // ── Scheduling (Step 12) ──
    // Height (m) the player must reach before projectile hazards arm. Aligned
    // with the warmup end so all hazards enter the pool together at 30 m.
    // DEV TIP: use the dev-only manual fire key (T) to test without climbing.
    startHeightMeters: 30,
    // Random spacing (ms) between consecutive fire cycles.
    minFireIntervalMs: 4500,
    maxFireIntervalMs: 9500,
    // Warning telegraph (ms) before a projectile actually fires. Raised with the
    // faster shots (13.4) so the player still gets a fair reaction window.
    minWarningMs: 450,
    // Cap on simultaneously live projectiles.
    maxActiveProjectiles: 3,

    // ── Physics (Step 13, tuned 13.3 small + 13.4 fast/hard) ──
    radius: 7,
    // Net downward gravity for projectiles (~0.78 of world gravity ≈ 624 px/s²)
    // so the fast shots stay snappy without flying dead straight. Projectile
    // sets body gravity = gravityY - DEFAULT_GRAVITY because the world already
    // applies DEFAULT_GRAVITY to every dynamic body.
    gravityY: Math.round(DEFAULT_GRAVITY * 0.78),
    bounce: 0.78,
    // Horizontal spawn offset (px) outside the play area.
    spawnMarginX: 28,
    // Keep spawn Y away from the exact screen top/bottom edges (px).
    spawnVerticalPadding: 80,
    // How far (px) past the viewport a projectile may travel before cleanup.
    // Larger than spawnMarginX + radius so a fast fresh shot is never culled
    // before it travels into view, but small enough that it dies soon after
    // leaving the screen.
    cleanupMargin: 160,
    // Min spacing (ms) between two knockbacks from the SAME projectile.
    playerHitCooldownMs: 650,

    // ── Aiming (Step 13.1, sped up 13.3 → harder 13.4) ──
    // Projectiles are aimed at the player's current vertical alignment, with a
    // little jitter so they are not perfect snipers.
    minAimSpeed: 620,
    maxAimSpeed: 880,
    targetYJitterPx: 40,
    // Clamp on the initial vertical velocity so the faster aim can come in at a
    // more aggressive angle without launching a near-vertical shot.
    maxInitialVelocityY: 300,
    // Floor on the horizontal launch speed so a steeply-aimed shot still crosses
    // the screen instead of stalling at the edge.
    minHorizontalSpeed: 280,

    // ── Rendering ──
    // Above gameplay/FX, below the HUD (90).
    depth: 70,

    // ── Knockback (hardened 13.4) ──
    knockbackXMultiplier: 1.05,
    knockbackYMultiplier: 0.55,
    minKnockbackX: 320,
    maxKnockbackX: 780,
    maxKnockbackY: 460,
    // Hit-stun duration (ms): player movement/jump input is ignored this long.
    controlLockMs: 260,
    // Below this |vx|, derive knockback direction from relative position rather
    // than velocity sign.
    knockbackDirVelocityThreshold: 60,

    // ── Visuals (primitive shapes only, no assets) ──
    // Warning marker fade duration (ms) — kept in sync with minWarningMs.
    warningDurationMs: 450,
    warning: {
      thickness: 6,
      color: 0xff5566,
      alpha: 0.55,
      depth: 95,
      // Short marker centred on the player's height (not a full-height bar).
      markerHeight: 64,
    },
  },

  snow: {
    // Height (m) before Snow Time can be scheduled. Aligned with the warmup end
    // so snow (and the hail mixed into it) enters the pool at 30 m like the rest.
    startHeightMeters: 30,
    // Hard cap on snow events within a single tower run.
    maxPerTower: 3,
    // Random spacing (ms) between snow events — kept large so it is rare.
    minIntervalMs: 25000,
    maxIntervalMs: 45000,
    // Minimum climbed height (m) between two snow events (anti-clustering).
    minSpacingMeters: 45,
    // Random duration (ms) a snow event lasts once started.
    durationMinMs: 9000,
    durationMaxMs: 14000,
  },
};
