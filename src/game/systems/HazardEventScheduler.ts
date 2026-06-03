import { HAZARD_CONFIG } from "../config/hazardConfig";
import type {
  GameState,
  HazardEventPayload,
  HazardSchedulerSnapshot,
  HazardSide,
} from "../types/gameTypes";

interface HazardUpdateParams {
  time: number;
  delta: number;
  heightMeters: number;
  gameState: GameState;
}

// Central, delta-driven scheduler for competitive hazard events.
//
// This step produces ONLY the timing/event stream — no projectiles, no snow
// particles. Steps 13/14 will consume the emitted HazardEventPayload[] to drive
// the real systems.
//
// Why delta-based (not wall-clock): update() is only called while the run is
// actively playing. Skipping it during pause / gameOver / towerComplete freezes
// every timer automatically, so events never accumulate and burst on resume.
export class HazardEventScheduler {
  // ── Side projectile state ──────────────────────────────────────────────────
  private projectileHazardEnabled = false;
  private hasInitializedProjectileTimer = false;
  private elapsedProjectileMs = 0;
  private nextProjectileFireMs = 0;
  private pendingProjectileWarning = false;
  private pendingProjectileSide: HazardSide | null = null;
  private projectileWarningRemainingMs = 0;

  // ── Snow state ─────────────────────────────────────────────────────────────
  private hasInitializedSnowTimer = false;
  private elapsedSnowMs = 0;
  private nextSnowStartMs = 0;
  private snowActive = false;
  private snowRemainingMs = 0;
  private snowEventsUsed = 0;
  private lastSnowHeightMeters: number | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  // Restores a clean state for a fresh run. A new scene also constructs a new
  // instance, but reset() keeps reuse safe and explicit.
  reset(): void {
    this.projectileHazardEnabled = false;
    this.hasInitializedProjectileTimer = false;
    this.elapsedProjectileMs = 0;
    this.nextProjectileFireMs = 0;
    this.pendingProjectileWarning = false;
    this.pendingProjectileSide = null;
    this.projectileWarningRemainingMs = 0;

    this.hasInitializedSnowTimer = false;
    this.elapsedSnowMs = 0;
    this.nextSnowStartMs = 0;
    this.snowActive = false;
    this.snowRemainingMs = 0;
    this.snowEventsUsed = 0;
    this.lastSnowHeightMeters = null;
  }

  // Advances all timers by delta and returns the hazard events triggered this
  // frame. Returns an empty array outside the playing state or when disabled.
  update(params: HazardUpdateParams): HazardEventPayload[] {
    const events: HazardEventPayload[] = [];

    if (!HAZARD_CONFIG.updateEnabled) return events;
    if (params.gameState !== "playing") return events;

    // Snow first so projectile scheduling sees this frame's snow state.
    this.updateSnow(events, params);
    this.updateProjectile(events, params);

    return events;
  }

  getSnapshot(): HazardSchedulerSnapshot {
    return {
      isProjectileHazardEnabled: this.projectileHazardEnabled,
      isSnowActive: this.snowActive,
      snowEventsUsed: this.snowEventsUsed,
      nextProjectileFireInMs: Math.max(0, this.nextProjectileFireMs - this.elapsedProjectileMs),
      nextSnowEventInMs: this.snowActive
        ? this.snowRemainingMs
        : Math.max(0, this.nextSnowStartMs - this.elapsedSnowMs),
    };
  }

  isSnowActive(): boolean { return this.snowActive; }
  isProjectileHazardEnabled(): boolean { return this.projectileHazardEnabled; }

  // ── Snow scheduling ──────────────────────────────────────────────────────

  private updateSnow(events: HazardEventPayload[], params: HazardUpdateParams): void {
    const cfg = HAZARD_CONFIG.snow;
    const { delta, heightMeters, time } = params;

    if (heightMeters < cfg.startHeightMeters) return;

    // Active: count down, then end.
    if (this.snowActive) {
      this.snowRemainingMs -= delta;
      if (this.snowRemainingMs <= 0) {
        this.snowActive = false;
        this.snowRemainingMs = 0;
        this.elapsedSnowMs = 0;
        this.nextSnowStartMs = this.randomBetween(cfg.minIntervalMs, cfg.maxIntervalMs);
        events.push({ type: "snow_end", heightMeters, time });
      }
      return;
    }

    // Arm the first interval the moment scheduling becomes possible.
    if (!this.hasInitializedSnowTimer) {
      this.hasInitializedSnowTimer = true;
      this.elapsedSnowMs = 0;
      this.nextSnowStartMs = this.randomBetween(cfg.minIntervalMs, cfg.maxIntervalMs);
    }

    if (this.snowEventsUsed >= cfg.maxPerTower) return;

    this.elapsedSnowMs += delta;

    // Both a time interval AND a climbed-height spacing must be satisfied so
    // events stay rare and never cluster.
    const spacingSatisfied =
      this.lastSnowHeightMeters === null ||
      heightMeters - this.lastSnowHeightMeters >= cfg.minSpacingMeters;

    if (this.elapsedSnowMs >= this.nextSnowStartMs && spacingSatisfied) {
      this.snowActive = true;
      this.snowRemainingMs = this.randomBetween(cfg.durationMinMs, cfg.durationMaxMs);
      this.snowEventsUsed += 1;
      this.lastSnowHeightMeters = heightMeters;
      events.push({ type: "snow_start", heightMeters, time });
    }
  }

  // ── Side projectile scheduling ───────────────────────────────────────────

  private updateProjectile(events: HazardEventPayload[], params: HazardUpdateParams): void {
    const cfg = HAZARD_CONFIG.sideProjectile;
    const { delta, heightMeters, time } = params;

    // Arm once the height threshold is crossed; stay armed for the run.
    if (!this.projectileHazardEnabled) {
      if (heightMeters < cfg.startHeightMeters) return;
      this.projectileHazardEnabled = true;
    }

    // Snow freezes projectile scheduling (config-gated) — pending warning and
    // timer simply do not advance this frame.
    if (HAZARD_CONFIG.snowPausesProjectileHazards && this.snowActive) return;

    // Phase 2: a warning is counting down toward its fire.
    if (this.pendingProjectileWarning) {
      this.projectileWarningRemainingMs -= delta;
      if (this.projectileWarningRemainingMs <= 0) {
        const side = this.pendingProjectileSide ?? undefined;
        this.pendingProjectileWarning = false;
        this.pendingProjectileSide = null;
        this.projectileWarningRemainingMs = 0;
        // Schedule the next cycle.
        this.elapsedProjectileMs = 0;
        this.nextProjectileFireMs = this.randomBetween(cfg.minFireIntervalMs, cfg.maxFireIntervalMs);
        events.push({ type: "side_projectile_fire", side, heightMeters, time });
      }
      return;
    }

    // Phase 1: count toward the next warning.
    if (!this.hasInitializedProjectileTimer) {
      this.hasInitializedProjectileTimer = true;
      this.elapsedProjectileMs = 0;
      this.nextProjectileFireMs = this.randomBetween(cfg.minFireIntervalMs, cfg.maxFireIntervalMs);
    }

    this.elapsedProjectileMs += delta;
    if (this.elapsedProjectileMs >= this.nextProjectileFireMs) {
      const side = this.randomSide();
      this.pendingProjectileWarning = true;
      this.pendingProjectileSide = side;
      this.projectileWarningRemainingMs = cfg.minWarningMs;
      events.push({ type: "side_projectile_warning", side, heightMeters, time });
    }
  }

  // ── Random helpers ─────────────────────────────────────────────────────────

  private randomBetween(minMs: number, maxMs: number): number {
    return minMs + Math.random() * (maxMs - minMs);
  }

  private randomSide(): HazardSide {
    return Math.random() < 0.5 ? "left" : "right";
  }
}
