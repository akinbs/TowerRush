import Phaser from "phaser";
import type { HazardSide, ProjectileConfig } from "../types/gameTypes";
import { DEFAULT_GRAVITY, GAME_WIDTH, TEX_PROJECTILE } from "../utils/constants";
import { HAZARD_CONFIG } from "../config/hazardConfig";

// A single side-hazard ice ball. Dynamic Arcade body, bounces off platforms,
// applies knockback (not death) to the player, and is cleaned up once it drifts
// well past the viewport. Per-projectile hit cooldown stops contact-spam.
export class Projectile {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly side: HazardSide;

  // Last time (ms) this projectile knocked the player back. Negative infinity
  // means it has never hit, so the first contact always lands.
  private lastPlayerHitTime = Number.NEGATIVE_INFINITY;

  constructor(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.Group,
    config: ProjectileConfig,
  ) {
    this.side = config.side;

    this.sprite = scene.physics.add.sprite(config.x, config.y, TEX_PROJECTILE);

    // CRITICAL ORDER: add to the physics group BEFORE configuring the body.
    // Arcade Group.add() runs createCallbackHandler, which resets the body to
    // the group's defaults (velocity 0, gravity 0, bounce 0). Configuring after
    // the add is the only way the values stick — doing it before left every
    // projectile motionless and invisible just off-screen.
    group.add(this.sprite);

    this.sprite.setDepth(HAZARD_CONFIG.sideProjectile.depth);
    this.sprite.setVisible(true);
    this.sprite.setActive(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(config.radius);
    body.setBounce(config.bounce);
    body.setCollideWorldBounds(false);
    body.setImmovable(false);
    // World gravity (DEFAULT_GRAVITY) is already applied to every dynamic body,
    // so offset the body gravity to reach the desired NET gravityY.
    body.setAllowGravity(true);
    body.setGravityY(config.gravityY - DEFAULT_GRAVITY);
    body.setVelocity(config.velocityX, config.velocityY);
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  getGameObject(): Phaser.Physics.Arcade.Sprite { return this.sprite; }
  getBody(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }
  getSide(): HazardSide { return this.side; }
  getX(): number { return this.sprite.x; }
  getY(): number { return this.sprite.y; }
  getVelocityX(): number { return this.getBody().velocity.x; }
  getVelocityY(): number { return this.getBody().velocity.y; }

  // ── Player hit cooldown ──────────────────────────────────────────────────

  canHitPlayer(time: number): boolean {
    return time - this.lastPlayerHitTime >= HAZARD_CONFIG.sideProjectile.playerHitCooldownMs;
  }

  markPlayerHit(time: number): void {
    this.lastPlayerHitTime = time;
  }

  // ── Cleanup window ─────────────────────────────────────────────────────────

  // True once the projectile has drifted a margin beyond the viewport on any
  // side — it stays alive (and dangerous) while merely off the visible edge.
  isOutsideCleanupWindow(cameraScrollY: number, viewportHeight: number): boolean {
    const margin = HAZARD_CONFIG.sideProjectile.cleanupMargin;
    const x = this.sprite.x;
    const y = this.sprite.y;
    const topY = cameraScrollY;
    const bottomY = cameraScrollY + viewportHeight;

    return (
      x < -margin ||
      x > GAME_WIDTH + margin ||
      y < topY - margin ||
      y > bottomY + margin
    );
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
