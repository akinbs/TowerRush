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
import { SNOW_CONFIG } from "../config/snowConfig";

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

  // Logical platform width (gameObject is display-scaled, so keep the source).
  private readonly width: number;

  // ── Breakable state ────────────────────────────────────────────────────
  private breakableState: BreakableState = "intact";
  private breakElapsedMs = 0;
  private hasBreakTriggered = false;

  // ── Moving state ───────────────────────────────────────────────────────
  private movingState: MovingState | null = null;

  // ── Snow cap (Step 14) ─────────────────────────────────────────────────
  // Temporary white overlay added when a Snow Time event starts. Owned here so
  // it follows moving platforms and dies with the platform; lifecycle decisions
  // (add / fade / clear) are driven by SnowController.
  private snowCap: Phaser.GameObjects.Rectangle | null = null;
  private snowCapFading = false;
  // The active fade-out tween, so a cap can be revived (snow restarts) or killed
  // (break / cleanup) mid-fade.
  private snowCapTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, config: PlatformConfig) {
    this.type = config.type;
    this.width = config.width;

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
  // Returns true only on the call that actually starts the crack (so GameScene
  // can play the crack SFX exactly once); false on repeat contacts or non-breakables.
  triggerBreak(): boolean {
    if (!this.isBreakable() || this.hasBreakTriggered) return false;
    this.hasBreakTriggered = true;
    this.breakableState = "cracking";
    this.breakElapsedMs = 0;
    return true;
  }

  // ── Snow cap API (Step 14) ─────────────────────────────────────────────

  hasSnowCap(): boolean { return this.snowCap !== null; }
  isSnowCapFading(): boolean { return this.snowCapFading; }

  // Adds a snow cap on the platform's top edge. Idempotent: if a cap already
  // exists it is kept; if that cap was fading out (snow restarted) the fade is
  // cancelled and full opacity restored. No-op on a broken platform.
  addSnowCap(scene: Phaser.Scene): void {
    if (this.isBroken()) return;

    if (this.snowCap !== null) {
      if (this.snowCapFading) {
        this.snowCapTween?.stop();
        this.snowCapTween = null;
        this.snowCapFading = false;
        this.snowCap.setAlpha(SNOW_CONFIG.cap.alpha);
      }
      return;
    }

    const c = SNOW_CONFIG.cap;
    const capWidth = Math.max(4, this.width - c.widthInset);
    const topY = this.gameObject.y - PLATFORM_HEIGHT / 2;

    this.snowCap = scene.add
      .rectangle(this.gameObject.x, topY - c.height / 2, capWidth, c.height, c.color, c.alpha)
      .setDepth(c.depthOffset);
    this.snowCap.setVisible(this.gameObject.visible);
  }

  // Keeps the cap glued to the platform top and in sync with its visibility
  // (handles moving platforms and regional render hide/show). Cheap no-op when
  // there is no cap.
  updateSnowCap(): void {
    if (this.snowCap === null) return;
    const topY = this.gameObject.y - PLATFORM_HEIGHT / 2;
    this.snowCap.setPosition(this.gameObject.x, topY - SNOW_CONFIG.cap.height / 2);
    this.snowCap.setVisible(this.gameObject.visible);
  }

  // Fades the cap out over fadeMs (snow ending). fadeMs <= 0 destroys at once.
  // Guards against double-removal; the fade is self-managed.
  removeSnowCap(fadeMs = 0): void {
    if (this.snowCap === null || this.snowCapFading) return;
    const cap = this.snowCap;

    if (fadeMs <= 0) {
      cap.destroy();
      this.snowCap = null;
      return;
    }

    this.snowCapFading = true;
    this.snowCapTween = cap.scene.tweens.add({
      targets: cap,
      alpha: 0,
      duration: fadeMs,
      ease: "Quad.Out",
      onComplete: () => {
        cap.destroy();
        if (this.snowCap === cap) {
          this.snowCap = null;
          this.snowCapFading = false;
          this.snowCapTween = null;
        }
      },
    });
  }

  // Immediate, unconditional cap teardown (break / cleanup / restart). Ignores
  // the fade guard so a fading cap is killed at once too.
  destroySnowCap(): void {
    if (this.snowCap === null) return;
    this.snowCapTween?.stop();
    this.snowCapTween = null;
    this.snowCap.destroy();
    this.snowCap = null;
    this.snowCapFading = false;
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
    // A shattered platform drops any snow it was holding.
    this.destroySnowCap();
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
