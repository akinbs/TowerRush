import Phaser from "phaser";
import type { MovingPlatformConfig, PlatformConfig, PlatformType } from "../types/gameTypes";
import {
  BREAKABLE_BREAK_DELAY_MS,
  BREAKABLE_WARNING_FLASH_INTERVAL_MS,
  PLATFORM_HEIGHT,
  TEX_PLATFORM,
  TEX_PLATFORM_BREAKABLE,
  TEX_PLATFORM_GOAL,
  TEX_PLATFORM_MOVING,
  TEX_PLATFORM_SLIPPERY,
} from "../utils/constants";

type BreakableState = "intact" | "cracking" | "broken";

interface MovingState {
  minX: number;
  maxX: number;
  speedPxPerSecond: number;
  direction: 1 | -1;
  deltaX: number;
}

export class Platform {
  readonly gameObject: Phaser.Physics.Arcade.Image;
  readonly type: PlatformType;

  // ── Breakable state ────────────────────────────────────────────────────
  private breakableState: BreakableState = "intact";
  private breakElapsedMs = 0;
  private hasBreakTriggered = false;

  // ── Moving state ───────────────────────────────────────────────────────
  private movingState: MovingState | null = null;

  constructor(scene: Phaser.Scene, config: PlatformConfig) {
    this.type = config.type;

    this.gameObject = scene.physics.add.staticImage(
      config.x,
      config.y,
      this.resolveTexture(config.type),
    );

    this.gameObject.setDisplaySize(config.width, PLATFORM_HEIGHT);

    const body = this.gameObject.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(config.width, PLATFORM_HEIGHT);
    body.reset(config.x, config.y);

    if (config.type === "moving" && config.moving) {
      this.initMoving(config.moving);
    }
  }

  // ── Type queries ───────────────────────────────────────────────────────

  getType(): PlatformType { return this.type; }
  isBreakable(): boolean  { return this.type === "breakable"; }
  isSlippery(): boolean   { return this.type === "slippery"; }
  isMoving(): boolean     { return this.type === "moving"; }
  isGoal(): boolean       { return this.type === "goal"; }
  isBroken(): boolean     { return this.breakableState === "broken"; }
  isCracking(): boolean   { return this.breakableState === "cracking"; }

  // ── Moving platform API ────────────────────────────────────────────────

  // deltaX accumulated in the most recent update() call.
  getDeltaX(): number {
    return this.movingState?.deltaX ?? 0;
  }

  // ── Breakable platform API ─────────────────────────────────────────────

  // Called by the collision callback on first top-contact. Idempotent.
  triggerBreak(): void {
    if (!this.isBreakable() || this.hasBreakTriggered) return;
    this.hasBreakTriggered = true;
    this.breakableState = "cracking";
    this.breakElapsedMs = 0;
  }

  // ── Frame tick ─────────────────────────────────────────────────────────

  // Advances all state machines by delta ms.
  // Returns true on the exact frame a breakable platform transitions to broken
  // so PlatformManager can call platformGroup.refresh().
  update(delta: number): boolean {
    let justBroken = false;

    // Breakable state machine
    if (this.breakableState === "cracking") {
      this.breakElapsedMs += delta;
      const flashPhase =
        Math.floor(this.breakElapsedMs / BREAKABLE_WARNING_FLASH_INTERVAL_MS) % 2;
      this.gameObject.setAlpha(flashPhase === 0 ? 1.0 : 0.4);
      if (this.breakElapsedMs >= BREAKABLE_BREAK_DELAY_MS) {
        this.breakNow();
        justBroken = true;
      }
    }

    // Moving state machine
    if (this.movingState !== null) {
      this.updateMoving(delta);
    }

    return justBroken;
  }

  // ── Private ────────────────────────────────────────────────────────────

  private initMoving(cfg: MovingPlatformConfig): void {
    this.movingState = {
      minX: cfg.minX,
      maxX: cfg.maxX,
      speedPxPerSecond: cfg.speedPxPerSecond,
      direction: 1,
      deltaX: 0,
    };
  }

  private updateMoving(delta: number): void {
    const state = this.movingState!;

    const proposedX =
      this.gameObject.x + state.direction * state.speedPxPerSecond * (delta / 1000);

    let newX: number;
    if (proposedX <= state.minX) {
      newX = state.minX;
      state.direction = 1;
    } else if (proposedX >= state.maxX) {
      newX = state.maxX;
      state.direction = -1;
    } else {
      newX = proposedX;
    }

    // Compute delta BEFORE repositioning (body.reset updates gameObject.x).
    state.deltaX = newX - this.gameObject.x;

    // Move game object and static body atomically.
    (this.gameObject.body as Phaser.Physics.Arcade.StaticBody).reset(
      newX,
      this.gameObject.y,
    );
  }

  private breakNow(): void {
    this.breakableState = "broken";
    this.gameObject.setAlpha(1.0);
    this.gameObject.setVisible(false);
    this.gameObject.setActive(false);
    (this.gameObject.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  private resolveTexture(type: PlatformType): string {
    switch (type) {
      case "slippery":  return TEX_PLATFORM_SLIPPERY;
      case "breakable": return TEX_PLATFORM_BREAKABLE;
      case "moving":    return TEX_PLATFORM_MOVING;
      case "goal":      return TEX_PLATFORM_GOAL;
      case "normal":
      default:          return TEX_PLATFORM;
    }
  }
}
