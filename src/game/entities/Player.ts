import Phaser from "phaser";
import type { FacingDirection, InputState, TowerPhaseConfig } from "../types/gameTypes";
import {
  COYOTE_TIME_MS,
  JUMP_BUFFER_MS,
  PLAYER_FRICTION_FACTOR,
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

  constructor(scene: Phaser.Scene, phase: TowerPhaseConfig) {
    this.moveSpeed = phase.playerMoveSpeed;
    this.jumpVelocity = phase.playerJumpVelocity;

    const spawnX = scene.scale.width / 2;
    const spawnY = WORLD_HEIGHT - PLAYER_HEIGHT / 2 - 24;

    this.gameObject = scene.physics.add.sprite(spawnX, spawnY, TEX_PLAYER);
    this.gameObject.setCollideWorldBounds(true);
    this.gameObject.setDisplaySize(PLAYER_WIDTH, PLAYER_HEIGHT);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
    body.setMaxVelocityY(1000);
  }

  update(input: InputState, time: number, _delta: number): void {
    this.updateGroundedState(time);
    this.applyHorizontalMovement(input);
    this.updateJumpBuffer(input, time);
    this.tryJump(time);
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
    return body.blocked.down;
  }

  // ── Horizontal movement ────────────────────────────────────────────────

  private applyHorizontalMovement(input: InputState): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;

    if (input.left) {
      body.setVelocityX(-this.moveSpeed);
      this.setFacingDirection("left");
    } else if (input.right) {
      body.setVelocityX(this.moveSpeed);
      this.setFacingDirection("right");
    } else {
      // Soft deceleration — responsive without being abrupt.
      body.setVelocityX(body.velocity.x * PLAYER_FRICTION_FACTOR);
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
}
