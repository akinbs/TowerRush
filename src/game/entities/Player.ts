import Phaser from "phaser";
import type { FacingDirection, InputState, PlatformType, TowerPhaseConfig } from "../types/gameTypes";
import {
  ANIM_PLAYER_FALL,
  ANIM_PLAYER_IDLE,
  ANIM_PLAYER_JUMP,
  ANIM_PLAYER_WALK,
  COYOTE_TIME_MS,
  JUMP_BUFFER_MS,
  PLAYER_NORMAL_FRICTION_FACTOR,
  PLAYER_SLIPPERY_ACCEL_LERP,
  PLAYER_SLIPPERY_FRICTION_FACTOR,
  PLAYER_SLIPPERY_SPEED_MULTIPLIER,
  PLAYER_SLIPPERY_TURN_LERP,
  PLAYER_HEIGHT,
  PLAYER_SQUASH_DURATION_MS,
  PLAYER_SQUASH_MIN_FACTOR,
  PLAYER_SQUASH_REF_VELOCITY,
  PLAYER_SQUASH_SCALE_X,
  PLAYER_SQUASH_SCALE_Y,
  PLAYER_WIDTH,
  TEX_PLAYER,
  WORLD_HEIGHT,
} from "../utils/constants";
import { SNOW_CONFIG } from "../config/snowConfig";

export class Player {
  readonly gameObject: Phaser.Physics.Arcade.Sprite;

  private facingDirection: FacingDirection = "right";
  private readonly moveSpeed: number;
  private readonly jumpVelocity: number;

  // Base sprite scale (set by setDisplaySize). Landing squash tweens deform
  // around these and always restore to them, so display size never drifts.
  private readonly baseScaleX: number;
  private readonly baseScaleY: number;
  // Active squash tween, so a rapid second landing cancels the first cleanly.
  private squashTween: Phaser.Tweens.Tween | null = null;

  // Remaining hit-stun (ms) after a projectile knockback. While > 0, movement
  // and jump input are ignored so the knockback velocity carries the player.
  private controlLockRemainingMs = 0;

  // Snow Time environmental modifier. While true, horizontal control is heavier
  // and jump is very slightly weaker (platforms must stay reachable).
  private snowActive = false;

  // Time (ms) of the last frame the player was confirmed grounded.
  // Negative infinity means the player has never been grounded or just jumped.
  private lastGroundedTime = Number.NEGATIVE_INFINITY;

  // Time (ms) of the most recent jump-press event.
  // Negative infinity means no buffered press.
  private lastJumpPressedTime = Number.NEGATIVE_INFINITY;

  // Prevents using coyote time twice for a single edge departure.
  private coyoteUsed = false;

  // Type of the platform the player is currently standing on.
  // null when airborne or standing on the ground (which has no Platform entity).
  private currentGroundPlatformType: PlatformType | null = null;

  // ── SFX event flags ──────────────────────────────────────────────────────
  // One-shot flags consumed by GameScene to trigger jump/land sounds. They are
  // set during update() and cleared on consume; a fresh Player (scene.restart)
  // starts with them all false.
  private justJumped = false;
  private justLanded = false;
  private landingVelocityY = 0;
  // Grounded state at the end of the previous frame — used to detect the exact
  // airborne→grounded transition (the landing).
  private wasGroundedLastFrame = false;
  // Last downward velocity recorded while airborne — captured before the
  // collision zeroes velocity.y, so it approximates the impact speed.
  private lastAirborneVelocityY = 0;

  constructor(scene: Phaser.Scene, phase: TowerPhaseConfig) {
    this.moveSpeed = phase.playerMoveSpeed;
    this.jumpVelocity = phase.playerJumpVelocity;

    const spawnX = scene.scale.width / 2;
    const spawnY = WORLD_HEIGHT - PLAYER_HEIGHT / 2 - 24;

    this.gameObject = scene.physics.add.sprite(spawnX, spawnY, TEX_PLAYER, 0);
    // World bounds collision disabled — horizontal wrap is handled manually,
    // vertical ground collision is handled by the platform StaticGroup collider.
    this.gameObject.setCollideWorldBounds(false);
    this.gameObject.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
    body.setMaxVelocityY(1000);

    // Capture the scale setDisplaySize produced as the squash baseline.
    this.baseScaleX = this.gameObject.scaleX;
    this.baseScaleY = this.gameObject.scaleY;
  }

  update(input: InputState, time: number, delta: number): void {
    const grounded = this.isGrounded();
    // Detect the airborne→grounded transition (a landing) before any physics
    // this frame can change the flags. landingVelocityY is the last airborne
    // downward velocity, captured before the collision zeroed velocity.y.
    if (grounded && !this.wasGroundedLastFrame) {
      this.justLanded = true;
      this.landingVelocityY = this.lastAirborneVelocityY;
    }

    this.updateGroundedState(time);
    // Clear ground-platform type while airborne so slippery physics can't
    // persist after the player has left the surface.
    if (!grounded) {
      this.currentGroundPlatformType = null;
    }

    this.tickControlLock(delta);
    if (this.controlLockRemainingMs > 0) {
      // Hit stun: ignore movement & jump input so the knockback velocity carries
      // the player. Gravity/bounce/knockback keep integrating via physics.
      this.updateAnimation();
    } else {
      this.applyHorizontalMovement(input);
      this.updateJumpBuffer(input, time);
      this.tryJump(time);
      this.updateAnimation();
    }

    // Record airborne velocity for next-frame landing detection, and remember
    // this frame's grounded state for the transition check above.
    if (!grounded) {
      this.lastAirborneVelocityY = this.getVelocityY();
    }
    this.wasGroundedLastFrame = grounded;
  }

  // ── SFX event consumption ──────────────────────────────────────────────────

  // Returns true exactly once per real jump (ground, coyote, or buffered).
  consumeJustJumped(): boolean {
    const value = this.justJumped;
    this.justJumped = false;
    return value;
  }

  // Returns the landing event once per touchdown. velocityY is the downward
  // impact speed (px/s); GameScene uses it to gate and scale the land SFX.
  consumeJustLanded(): { landed: boolean; velocityY: number } {
    const result = { landed: this.justLanded, velocityY: this.landingVelocityY };
    this.justLanded = false;
    this.landingVelocityY = 0;
    return result;
  }

  // ── Ground state ───────────────────────────────────────────────────────

  private updateGroundedState(time: number): void {
    if (this.isGrounded()) {
      this.lastGroundedTime = time;
      this.coyoteUsed = false;
    }
  }

  isGrounded(): boolean {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    // blocked.down: stopped by an immovable body or world bound from below.
    // touching.down: in contact with another body from below this frame.
    // Both are checked so StaticGroup collision and world-bound collision both register.
    return body.blocked.down || body.touching.down;
  }

  // ── Horizontal movement ────────────────────────────────────────────────

  private applyHorizontalMovement(input: InputState): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;

    if (this.currentGroundPlatformType === "slippery") {
      this.applySlipperyMovement(body, input);
    } else {
      this.applyNormalMovement(body, input);
    }
  }

  // Normal ground: instant velocity set — responsive, predictable.
  private applyNormalMovement(
    body: Phaser.Physics.Arcade.Body,
    input: InputState,
  ): void {
    const moveSpeed = this.currentMoveSpeed();
    if (input.left) {
      body.setVelocityX(-moveSpeed);
      this.setFacingDirection("left");
    } else if (input.right) {
      body.setVelocityX(moveSpeed);
      this.setFacingDirection("right");
    } else {
      const friction = this.snowActive
        ? PLAYER_NORMAL_FRICTION_FACTOR * SNOW_CONFIG.player.frictionMultiplier
        : PLAYER_NORMAL_FRICTION_FACTOR;
      body.setVelocityX(body.velocity.x * friction);
    }
  }

  // Slippery ground: lerp-based velocity — fast but hard to stop or reverse.
  //
  // Three distinct behaviours:
  //   • Same-direction input  → lerp toward higher target speed (ACCEL_LERP)
  //   • Opposite-direction input → lerp toward reversed speed with slow lerp
  //                                (TURN_LERP) — feels like trying to brake on ice
  //   • No input              → friction decay (FRICTION_FACTOR near 1 → long slide)
  private applySlipperyMovement(
    body: Phaser.Physics.Arcade.Body,
    input: InputState,
  ): void {
    const currentVx = body.velocity.x;
    const maxSpeed   = this.currentMoveSpeed() * PLAYER_SLIPPERY_SPEED_MULTIPLIER;
    // Snow makes the ice harder to accelerate on (the slide itself is unchanged).
    const accelMul = this.snowActive ? SNOW_CONFIG.player.accelerationMultiplier : 1;

    if (input.left) {
      this.setFacingDirection("left");
      // Turning around (currently moving right) is harder than continuing left.
      const lerp = (currentVx > 0 ? PLAYER_SLIPPERY_TURN_LERP : PLAYER_SLIPPERY_ACCEL_LERP) * accelMul;
      body.setVelocityX(Phaser.Math.Linear(currentVx, -maxSpeed, lerp));
    } else if (input.right) {
      this.setFacingDirection("right");
      // Turning around (currently moving left) is harder than continuing right.
      const lerp = (currentVx < 0 ? PLAYER_SLIPPERY_TURN_LERP : PLAYER_SLIPPERY_ACCEL_LERP) * accelMul;
      body.setVelocityX(Phaser.Math.Linear(currentVx, maxSpeed, lerp));
    } else {
      // No input: very slow decay — character keeps sliding a long time.
      body.setVelocityX(currentVx * PLAYER_SLIPPERY_FRICTION_FACTOR);
    }
  }

  // ── Jump buffer ────────────────────────────────────────────────────────

  private updateJumpBuffer(input: InputState, time: number): void {
    if (input.jumpPressed) {
      this.lastJumpPressedTime = time;
    }
  }

  private hasBufferedJump(time: number): boolean {
    return time - this.lastJumpPressedTime <= JUMP_BUFFER_MS;
  }

  // ── Coyote time ────────────────────────────────────────────────────────

  // Returns true when the player recently left a platform but hasn't used
  // their coyote jump yet and is still within the coyote window.
  private canUseCoyoteTime(time: number): boolean {
    return (
      !this.isGrounded() &&
      !this.coyoteUsed &&
      time - this.lastGroundedTime <= COYOTE_TIME_MS
    );
  }

  // ── Jump decision ──────────────────────────────────────────────────────

  private canJump(time: number): boolean {
    return this.isGrounded() || this.canUseCoyoteTime(time);
  }

  private tryJump(time: number): void {
    if (this.canJump(time) && this.hasBufferedJump(time)) {
      this.performJump();
    }
  }

  private performJump(): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(this.currentJumpVelocity());

    // Consume both the coyote window and the jump buffer so neither
    // can trigger a second jump in the same aerial phase.
    this.coyoteUsed = true;
    this.lastGroundedTime = Number.NEGATIVE_INFINITY;
    this.lastJumpPressedTime = Number.NEGATIVE_INFINITY;

    // Flag the jump for the SFX layer (covers ground, coyote, and buffered jumps).
    this.justJumped = true;
  }

  // ── Facing direction ───────────────────────────────────────────────────

  setFacingDirection(direction: FacingDirection): void {
    if (this.facingDirection === direction) return;
    this.facingDirection = direction;
    this.gameObject.setFlipX(direction === "left");
  }

  getFacingDirection(): FacingDirection {
    return this.facingDirection;
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  getPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.gameObject.x, this.gameObject.y);
  }

  getX(): number { return this.gameObject.x; }
  getY(): number { return this.gameObject.y; }

  getGameObject(): Phaser.Physics.Arcade.Sprite { return this.gameObject; }

  // World Y of the player's feet — used to anchor jump/landing puff FX.
  getFootY(): number { return this.gameObject.y + PLAYER_HEIGHT / 2; }

  getVelocityY(): number {
    return (this.gameObject.body as Phaser.Physics.Arcade.Body).velocity.y;
  }

  getVelocityX(): number {
    return (this.gameObject.body as Phaser.Physics.Arcade.Body).velocity.x;
  }

  isFalling(): boolean {
    return !this.isGrounded() && this.getVelocityY() > 0;
  }

  isOnGround(): boolean {
    return this.isGrounded();
  }

  setGroundPlatformType(type: PlatformType | null): void {
    this.currentGroundPlatformType = type;
  }

  getGroundPlatformType(): PlatformType | null {
    return this.currentGroundPlatformType;
  }

  isOnSlipperyGround(): boolean {
    return this.isGrounded() && this.currentGroundPlatformType === "slippery";
  }

  // Displaces the player by deltaX pixels without affecting velocity.
  // Used to carry the player when standing on a moving platform.
  //
  // This runs inside scene.update(), which Phaser schedules AFTER the physics
  // step has already integrated this frame's velocity into body.position but
  // BEFORE postUpdate() syncs the sprite. So we add the carry directly onto the
  // integrated body.position — never rebuild it from the stale sprite x (which
  // still holds last frame's value). Rebuilding from the sprite would discard
  // the player's own walking movement and lock them to the platform.
  //
  // We must NOT touch the sprite x or body.prevFrame here: postUpdate() applies
  // the full delta (velocity movement + carry) to the sprite incrementally, so
  // doing it ourselves would double-count the carry. Velocity is left intact,
  // so input-driven movement keeps working on top of the carry.
  applyExternalHorizontalDelta(deltaX: number): void {
    if (deltaX === 0) return;
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.position.x += deltaX;
  }

  // ── Knockback / hit stun ────────────────────────────────────────────────────

  // Applies a projectile knockback impulse: overrides velocity with the given
  // values and starts a short control lock. Velocity is set (not added) so the
  // hit reads as a decisive shove regardless of the player's prior momentum.
  applyKnockback(params: { velocityX: number; velocityY: number; controlLockMs: number }): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(params.velocityX, params.velocityY);
    this.controlLockRemainingMs = Math.max(this.controlLockRemainingMs, params.controlLockMs);
    if (params.velocityX > 0) this.setFacingDirection("right");
    else if (params.velocityX < 0) this.setFacingDirection("left");
  }

  isControlLocked(): boolean {
    return this.controlLockRemainingMs > 0;
  }

  // ── Snow environmental modifier ─────────────────────────────────────────────

  // Toggled by GameScene on snow_start / snow_end. Cleared on a fresh Player
  // (scene.restart), so movement always returns to normal between runs.
  setSnowModifier(active: boolean): void {
    this.snowActive = active;
  }

  private currentMoveSpeed(): number {
    return this.snowActive ? this.moveSpeed * SNOW_CONFIG.player.speedMultiplier : this.moveSpeed;
  }

  private currentJumpVelocity(): number {
    return this.snowActive ? this.jumpVelocity * SNOW_CONFIG.player.jumpMultiplier : this.jumpVelocity;
  }

  private tickControlLock(delta: number): void {
    if (this.controlLockRemainingMs > 0) {
      this.controlLockRemainingMs -= delta;
      if (this.controlLockRemainingMs < 0) this.controlLockRemainingMs = 0;
    }
  }

  // ── Landing squash/stretch ─────────────────────────────────────────────────

  // Briefly squashes the sprite (wider + shorter) on landing, then springs back
  // to the base scale. Deformation scales with impact speed. Safe with the
  // animation system (only scale changes, frames untouched) and with facing
  // (direction is setFlipX, not scaleX sign).
  applyLandingSquash(impactVelocityY = 0): void {
    const sprite = this.gameObject;

    // Cancel any in-flight squash so the new one starts from a clean base.
    if (this.squashTween !== null) {
      this.squashTween.stop();
      this.squashTween = null;
    }

    const t = Phaser.Math.Clamp(impactVelocityY / PLAYER_SQUASH_REF_VELOCITY, 0, 1);
    const factor = Phaser.Math.Linear(PLAYER_SQUASH_MIN_FACTOR, 1, t);
    const squashX = this.baseScaleX * (1 + (PLAYER_SQUASH_SCALE_X - 1) * factor);
    const squashY = this.baseScaleY * (1 - (1 - PLAYER_SQUASH_SCALE_Y) * factor);

    sprite.setScale(squashX, squashY);
    this.squashTween = sprite.scene.tweens.add({
      targets: sprite,
      scaleX: this.baseScaleX,
      scaleY: this.baseScaleY,
      duration: PLAYER_SQUASH_DURATION_MS,
      ease: "Back.Out",
      onComplete: () => {
        this.squashTween = null;
        sprite.setScale(this.baseScaleX, this.baseScaleY);
      },
    });
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  private updateAnimation(): void {
    let key: string;
    if (!this.isGrounded()) {
      key = this.getVelocityY() < 0 ? ANIM_PLAYER_JUMP : ANIM_PLAYER_FALL;
    } else if (Math.abs(this.getVelocityX()) > 10) {
      key = ANIM_PLAYER_WALK;
    } else {
      key = ANIM_PLAYER_IDLE;
    }
    this.playAnim(key);
  }

  private playAnim(key: string): void {
    if (this.gameObject.anims.currentAnim?.key === key) return;
    this.gameObject.play(key, true);
  }

  // Teleports the player to the opposite horizontal edge when they leave the world.
  // Velocity and facing direction are preserved; the body is reset cleanly.
  applyHorizontalWrap(worldWidth: number): void {
    const hw = PLAYER_WIDTH / 2;
    let newX: number | null = null;

    if (this.gameObject.x - hw > worldWidth) {
      newX = -hw;
    } else if (this.gameObject.x + hw < 0) {
      newX = worldWidth + hw;
    }

    if (newX === null) return;

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    body.reset(newX, this.gameObject.y);
    body.setVelocity(vx, vy);
  }
}
