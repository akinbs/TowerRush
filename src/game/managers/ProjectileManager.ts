import Phaser from "phaser";
import { Projectile } from "../entities/Projectile";
import type { Player } from "../entities/Player";
import type { HazardSide, ProjectileHitPayload } from "../types/gameTypes";
import { GAME_HEIGHT, GAME_WIDTH } from "../utils/constants";
import { HAZARD_CONFIG } from "../config/hazardConfig";

const IS_DEV = import.meta.env.DEV;

// Phaser's ArcadePhysicsCallback passes this broad union for each collider body.
type ArcadeOverlapObject =
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Tilemaps.Tile;

interface ProjectileManagerParams {
  scene: Phaser.Scene;
  platformGroup: Phaser.Physics.Arcade.StaticGroup;
  player: Player;
  onPlayerHit: (hit: ProjectileHitPayload) => void;
}

interface ShowWarningParams {
  side: HazardSide;
  cameraScrollY: number;
  playerY: number;
}

interface FireFromSideParams {
  side: HazardSide;
  cameraScrollY: number;
  playerX: number;
  playerY: number;
  // Reserved for future lead prediction; unused for now.
  playerVelocityX?: number;
  playerVelocityY?: number;
}

// Spawns and manages side-hazard projectiles.
//
// Collision wiring (registered once):
//   • collider(group, platforms) → projectiles bounce off all platforms.
//   • overlap(player, group)      → detect-only; applies knockback via callback
//                                   without blocking/destroying the projectile.
export class ProjectileManager {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly onPlayerHit: (hit: ProjectileHitPayload) => void;

  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly projectiles: Projectile[] = [];
  // Maps a physics game object back to its Projectile for overlap lookups.
  private readonly byGameObject = new Map<Phaser.GameObjects.GameObject, Projectile>();
  private readonly warningMarkers: Phaser.GameObjects.Rectangle[] = [];
  // Target Y (world) locked in when a warning shows, so the matching fire aims
  // at the same height the player was telegraphed.
  private readonly pendingTargetBySide = new Map<HazardSide, number>();

  constructor(params: ProjectileManagerParams) {
    this.scene = params.scene;
    this.player = params.player;
    this.onPlayerHit = params.onPlayerHit;

    this.group = this.scene.physics.add.group();
    this.scene.physics.add.collider(this.group, params.platformGroup);
    this.scene.physics.add.overlap(
      this.player.getGameObject(),
      this.group,
      this.handleOverlap,
      undefined,
      this,
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  // Brief screen-space marker at the player's height, telegraphing the side and
  // alignment of the incoming shot. Locks in the target Y the fire will reuse.
  showWarning(params: ShowWarningParams): void {
    const cfg = HAZARD_CONFIG.sideProjectile;
    const w = cfg.warning;
    const { side, cameraScrollY, playerY } = params;

    const targetY = playerY + this.targetJitter();
    this.pendingTargetBySide.set(side, targetY);

    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;
    const x = side === "left" ? w.thickness / 2 : screenW - w.thickness / 2;
    const screenY = Phaser.Math.Clamp(
      targetY - cameraScrollY,
      w.markerHeight / 2,
      screenH - w.markerHeight / 2,
    );

    const marker = this.scene.add
      .rectangle(x, screenY, w.thickness, w.markerHeight, w.color, w.alpha)
      .setScrollFactor(0)
      .setDepth(w.depth);
    this.warningMarkers.push(marker);

    this.scene.tweens.add({
      targets: marker,
      alpha: 0,
      duration: cfg.warningDurationMs,
      ease: "Quad.Out",
      onComplete: () => this.removeWarning(marker),
    });
  }

  // Spawns one projectile from the hidden off-screen column, aimed at the
  // player's current vertical alignment (reusing the warning's target Y).
  fireFromSide(params: FireFromSideParams): void {
    const cfg = HAZARD_CONFIG.sideProjectile;
    const { side, cameraScrollY, playerX, playerY } = params;

    if (this.projectiles.length >= cfg.maxActiveProjectiles) {
      if (IS_DEV) console.info("[Projectile] fire skipped — max active reached");
      return;
    }

    // Reuse the warning's locked target so the telegraph matches the shot.
    const lockedTargetY = this.pendingTargetBySide.get(side);
    this.pendingTargetBySide.delete(side);
    const targetY = lockedTargetY ?? playerY + this.targetJitter();

    const spawnX = side === "left" ? -cfg.spawnMarginX : GAME_WIDTH + cfg.spawnMarginX;
    const spawnY = Phaser.Math.Clamp(
      targetY,
      cameraScrollY + cfg.spawnVerticalPadding,
      cameraScrollY + GAME_HEIGHT - cfg.spawnVerticalPadding,
    );

    const { velocityX, velocityY } = this.computeAimVelocity(
      side, spawnX, spawnY, playerX, targetY,
    );

    // Projectile adds ITSELF to the group (before body config) — see Projectile.
    const projectile = new Projectile(this.scene, this.group, {
      x: spawnX,
      y: spawnY,
      radius: cfg.radius,
      velocityX,
      velocityY,
      gravityY: cfg.gravityY,
      bounce: cfg.bounce,
      side,
    });

    this.projectiles.push(projectile);
    this.byGameObject.set(projectile.getGameObject(), projectile);

    if (IS_DEV) {
      console.info(
        `[Projectile] spawned side=${side} x=${Math.round(spawnX)} y=${Math.round(spawnY)} ` +
        `vx=${Math.round(velocityX)} vy=${Math.round(velocityY)}`,
      );
    }
  }

  // Removes projectiles that have drifted past the cleanup window. Iterates
  // backwards so in-place removal is safe.
  update(cameraScrollY: number, viewportHeight: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (projectile.isOutsideCleanupWindow(cameraScrollY, viewportHeight)) {
        if (IS_DEV) {
          console.info(
            `[Projectile] cleaned x=${Math.round(projectile.getX())} y=${Math.round(projectile.getY())}`,
          );
        }
        this.removeAt(i);
      }
    }
  }

  getActiveCount(): number {
    return this.projectiles.length;
  }

  // Destroys all live projectiles and warning markers (end of run / restart).
  clear(): void {
    for (const projectile of this.projectiles) {
      this.byGameObject.delete(projectile.getGameObject());
      projectile.destroy();
    }
    this.projectiles.length = 0;
    this.pendingTargetBySide.clear();
    this.clearWarnings();
  }

  destroy(): void {
    this.clear();
    this.group.destroy();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private handleOverlap(
    _playerGO: ArcadeOverlapObject,
    projectileGO: ArcadeOverlapObject,
  ): void {
    const go = projectileGO as unknown as Phaser.GameObjects.GameObject;
    const projectile = this.byGameObject.get(go);
    if (!projectile) return;

    const time = this.scene.time.now;
    if (!projectile.canHitPlayer(time)) return;
    projectile.markPlayerHit(time);

    this.onPlayerHit({
      projectileVelocityX: projectile.getVelocityX(),
      projectileVelocityY: projectile.getVelocityY(),
      projectileX: projectile.getX(),
      projectileY: projectile.getY(),
      playerX: this.player.getX(),
      playerY: this.player.getY(),
      side: projectile.getSide(),
    });
  }

  private removeAt(index: number): void {
    const projectile = this.projectiles[index];
    this.byGameObject.delete(projectile.getGameObject());
    this.projectiles.splice(index, 1);
    projectile.destroy();
  }

  private removeWarning(marker: Phaser.GameObjects.Rectangle): void {
    const index = this.warningMarkers.indexOf(marker);
    if (index !== -1) this.warningMarkers.splice(index, 1);
    marker.destroy();
  }

  private clearWarnings(): void {
    for (const marker of this.warningMarkers) {
      marker.destroy();
    }
    this.warningMarkers.length = 0;
  }

  private targetJitter(): number {
    const jitter = HAZARD_CONFIG.sideProjectile.targetYJitterPx;
    return Phaser.Math.Between(-jitter, jitter);
  }

  // Aims from the off-screen spawn toward (playerX, targetY). The horizontal
  // sign is forced from the side so the shot always travels inward; the vertical
  // component is clamped so gravity (not the launch) shapes the arc.
  private computeAimVelocity(
    side: HazardSide,
    spawnX: number,
    spawnY: number,
    playerX: number,
    targetY: number,
  ): { velocityX: number; velocityY: number } {
    const cfg = HAZARD_CONFIG.sideProjectile;
    const dx = playerX - spawnX;
    const dy = targetY - spawnY;
    const length = Math.hypot(dx, dy) || 1;
    const speed = Phaser.Math.Between(cfg.minAimSpeed, cfg.maxAimSpeed);

    const rawVx = (dx / length) * speed;
    // Guarantee a minimum horizontal speed so a steep aim still crosses the
    // screen, then force the sign inward from the spawn side.
    const horizontalSpeed = Math.max(Math.abs(rawVx), cfg.minHorizontalSpeed);
    const velocityX = side === "left" ? horizontalSpeed : -horizontalSpeed;
    const velocityY = Phaser.Math.Clamp(
      (dy / length) * speed,
      -cfg.maxInitialVelocityY,
      cfg.maxInitialVelocityY,
    );

    return { velocityX, velocityY };
  }
}
