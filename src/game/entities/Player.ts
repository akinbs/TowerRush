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
  PLAYER_WIDTH,
  TEX_PLAYER,
  WORLD_HEIGHT,
} from "../utils/constants";

export class Player {
  readonly gameObject: Phaser.Physics.Arcade.Sprite;

  private facingDirection: FacingDirection = "right";
  private readonly moveSpeed: number;
  private readonly jumpVelocity: number;

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
  }

  update(input: InputState, time: number, _delta: number): void {
    this.updateGroundedState(time);
    // Clear ground-platform type while airborne so slippery physics can't
    // persist after the player has left the surface.
    if (!this.isGrounded()) {
      this.currentGroundPlatformType = null;
    }
    this.applyHorizontalMovement(input);
    this.updateJumpBuffer(input, time);
    this.tryJump(time);
    this.updateAnimation();
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
    if (input.left) {
      body.setVelocityX(-this.moveSpeed);
      this.setFacingDirection("left");
    } else if (input.right) {
      body.setVelocityX(this.moveSpeed);
      this.setFacingDirection("right");
    } else {
      body.setVelocityX(body.velocity.x * PLAYER_NORMAL_FRICTION_FACTOR);
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
    const maxSpeed   = this.moveSpeed * PLAYER_SLIPPERY_SPEED_MULTIPLIER;

    if (input.left) {
      this.setFacingDirection("left");
      // Turning around (currently moving right) is harder than continuing left.
      const lerp = currentVx > 0 ? PLAYER_SLIPPERY_TURN_LERP : PLAYER_SLIPPERY_ACCEL_LERP;
      body.setVelocityX(Phaser.Math.Linear(currentVx, -maxSpeed, lerp));
    } else if (input.right) {
      this.setFacingDirection("right");
      // Turning around (currently moving left) is harder than continuing right.
      const lerp = currentVx < 0 ? PLAYER_SLIPPERY_TURN_LERP : PLAYER_SLIPPERY_ACCEL_LERP;
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
    body.setVelocityY(this.jumpVelocity);

    // Consume both the coyote window and the jump buffer so neither
    // can trigger a second jump in the same aerial phase.
    this.coyoteUsed = true;
    this.lastGroundedTime = Number.NEGATIVE_INFINITY;
    this.lastJumpPressedTime = Number.NEGATIVE_INFINITY;
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
  applyExternalHorizontalDelta(deltaX: number): void {
    if (deltaX === 0) return;
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    body.reset(this.gameObject.x + deltaX, this.gameObject.y);
    body.setVelocity(vx, vy);
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
