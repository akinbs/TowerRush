import Phaser from "phaser";
import type { HailstoneConfig } from "../types/gameTypes";
import { DEFAULT_GRAVITY, GAME_WIDTH, TEX_HAILSTONE_PREFIX } from "../utils/constants";
import { SNOW_CONFIG } from "../config/snowConfig";

// A single hailstone mixed into the snowfall: a small world-space ice ball that
// bounces off platforms, knocks the player back (never kills), and shatters
// after one platform bounce or a player hit. One texture exists per integer
// radius so the circle body always matches the sprite (no scaling).
export class Hailstone {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;

  private bounceCount = 0;
  private shattered = false;
  private lastPlayerHitTime = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene, group: Phaser.Physics.Arcade.Group, config: HailstoneConfig) {
    this.sprite = scene.physics.add.sprite(
      config.x,
      config.y,
      `${TEX_HAILSTONE_PREFIX}${config.radius}`,
    );

    // Add to the physics group BEFORE configuring the body — Arcade Group.add()
    // resets velocity/gravity/bounce to group defaults (see Projectile).
    group.add(this.sprite);

    this.sprite.setDepth(SNOW_CONFIG.hail.depth);
    this.sprite.setVisible(true);
    this.sprite.setActive(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(config.radius);
    body.setBounce(config.bounce);
    body.setCollideWorldBounds(false);
    body.setImmovable(false);
    body.setAllowGravity(true);
    body.setGravityY(config.gravityY - DEFAULT_GRAVITY);
    body.setVelocity(config.velocityX, config.velocityY);
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  getGameObject(): Phaser.Physics.Arcade.Sprite { return this.sprite; }
  getBody(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }
  getX(): number { return this.sprite.x; }
  getY(): number { return this.sprite.y; }
  getVelocityX(): number { return this.getBody().velocity.x; }
  getVelocityY(): number { return this.getBody().velocity.y; }

  // ── Hit cooldown ─────────────────────────────────────────────────────────

  canHitPlayer(time: number): boolean {
    return time - this.lastPlayerHitTime >= SNOW_CONFIG.hail.playerHitCooldownMs;
  }
  markPlayerHit(time: number): void { this.lastPlayerHitTime = time; }

  // ── Bounce / shatter ─────────────────────────────────────────────────────

  incrementBounceCount(): number { return ++this.bounceCount; }
  shouldShatter(): boolean { return this.bounceCount >= SNOW_CONFIG.hail.shatterAfterBounces; }

  isShattered(): boolean { return this.shattered; }
  markShattered(): void { this.shattered = true; }

  // ── Cleanup window ─────────────────────────────────────────────────────────

  isOutsideCleanupWindow(cameraScrollY: number, viewportHeight: number): boolean {
    const margin = SNOW_CONFIG.hail.cleanupMargin;
    const x = this.sprite.x;
    const y = this.sprite.y;
    return (
      x < -margin ||
      x > GAME_WIDTH + margin ||
      y < cameraScrollY - margin ||
      y > cameraScrollY + viewportHeight + margin
    );
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
