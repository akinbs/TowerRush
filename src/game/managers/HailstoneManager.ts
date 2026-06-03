import Phaser from "phaser";
import { Hailstone } from "../entities/Hailstone";
import type { Player } from "../entities/Player";
import type { HailstoneHitPayload } from "../types/gameTypes";
import { GAME_WIDTH } from "../utils/constants";
import { SNOW_CONFIG } from "../config/snowConfig";

// Phaser's ArcadePhysicsCallback passes this broad union for each collider body.
type ArcadeOverlapObject =
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Tilemaps.Tile;

interface HailstoneManagerParams {
  scene: Phaser.Scene;
  platformGroup: Phaser.Physics.Arcade.StaticGroup;
  player: Player;
  onPlayerHit: (hit: HailstoneHitPayload) => void;
  onShatter: (x: number, y: number) => void;
}

// Spawns hailstones AS PART OF the snowfall (not a separate timed hazard).
// While snow is active it drops small 1–3 clusters at random intervals, capped
// at a ratio of the flake count. Each stone shatters after one platform bounce
// or a player hit. Collision wiring is registered once:
//   • collider(group, platforms) → bounce, then shatter on first contact.
//   • overlap(player, group)      → knockback + shatter.
export class HailstoneManager {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly onPlayerHit: (hit: HailstoneHitPayload) => void;
  private readonly onShatter: (x: number, y: number) => void;

  private readonly group: Phaser.Physics.Arcade.Group;
  private readonly hailstones: Hailstone[] = [];
  private readonly byGameObject = new Map<Phaser.GameObjects.GameObject, Hailstone>();

  private spawning = false;
  private targetCount = 0;
  private clusterTimerMs = 0;
  private nextClusterIntervalMs = 0;

  constructor(params: HailstoneManagerParams) {
    this.scene = params.scene;
    this.player = params.player;
    this.onPlayerHit = params.onPlayerHit;
    this.onShatter = params.onShatter;

    this.group = this.scene.physics.add.group();
    this.scene.physics.add.collider(
      this.group,
      params.platformGroup,
      this.handlePlatformCollide,
      undefined,
      this,
    );
    this.scene.physics.add.overlap(
      this.player.getGameObject(),
      this.group,
      this.handleOverlap,
      undefined,
      this,
    );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  // Begins mixing hail into an active snowfall. The live cap is a ratio of the
  // flake count, clamped per device for performance.
  start(params: { snowParticleCount: number; isMobile: boolean }): void {
    const cfg = SNOW_CONFIG.hail;
    if (!cfg.enabled) return;

    const maxActive = params.isMobile ? cfg.maxActiveMobile : cfg.maxActiveDesktop;
    this.targetCount = Math.min(
      Math.floor(params.snowParticleCount * cfg.toSnowRatio),
      maxActive,
    );

    this.spawning = true;
    this.clusterTimerMs = 0;
    this.nextClusterIntervalMs = this.randomClusterInterval();
  }

  // Stops new clusters; existing hail keeps falling and is cleaned up normally.
  stopSpawning(): void {
    this.spawning = false;
  }

  update(params: { delta: number; cameraScrollY: number; viewportHeight: number }): void {
    const { delta, cameraScrollY, viewportHeight } = params;

    // Cull anything that drifted out of the world window.
    for (let i = this.hailstones.length - 1; i >= 0; i--) {
      if (this.hailstones[i].isOutsideCleanupWindow(cameraScrollY, viewportHeight)) {
        this.removeAt(i);
      }
    }

    if (!this.spawning) return;

    this.clusterTimerMs += delta;
    if (this.clusterTimerMs >= this.nextClusterIntervalMs) {
      this.clusterTimerMs = 0;
      this.nextClusterIntervalMs = this.randomClusterInterval();

      const cfg = SNOW_CONFIG.hail;
      const clusterCount = Phaser.Math.Between(cfg.clusterMinCount, cfg.clusterMaxCount);
      for (let k = 0; k < clusterCount; k++) {
        if (this.hailstones.length >= this.targetCount) break;
        this.spawnHailstone(cameraScrollY);
      }
    }
  }

  getActiveCount(): number {
    return this.hailstones.length;
  }

  clear(): void {
    for (const hail of this.hailstones) {
      this.byGameObject.delete(hail.getGameObject());
      hail.destroy();
    }
    this.hailstones.length = 0;
    this.spawning = false;
  }

  destroy(): void {
    this.clear();
    this.group.destroy();
  }

  // ── Private: spawning ────────────────────────────────────────────────────

  private spawnHailstone(cameraScrollY: number): void {
    const cfg = SNOW_CONFIG.hail;
    const radius = Phaser.Math.Between(cfg.radiusMin, cfg.radiusMax);
    const x = Phaser.Math.Between(0, GAME_WIDTH);
    const y = cameraScrollY - Phaser.Math.Between(cfg.spawnAboveMinPx, cfg.spawnAboveMaxPx);
    const velocityX = Phaser.Math.Between(cfg.minVelocityX, cfg.maxVelocityX);
    const velocityY = Phaser.Math.Between(cfg.minVelocityY, cfg.maxVelocityY);

    const hail = new Hailstone(this.scene, this.group, {
      x, y, radius, velocityX, velocityY, gravityY: cfg.gravityY, bounce: cfg.bounce,
    });

    this.hailstones.push(hail);
    this.byGameObject.set(hail.getGameObject(), hail);
  }

  private randomClusterInterval(): number {
    const cfg = SNOW_CONFIG.hail;
    return Phaser.Math.Between(cfg.clusterMinIntervalMs, cfg.clusterMaxIntervalMs);
  }

  // ── Private: collisions ──────────────────────────────────────────────────

  private handlePlatformCollide(
    hailGO: ArcadeOverlapObject,
    _platformGO: ArcadeOverlapObject,
  ): void {
    const hail = this.byGameObject.get(hailGO as unknown as Phaser.GameObjects.GameObject);
    if (!hail || hail.isShattered()) return;

    hail.incrementBounceCount();
    if (hail.shouldShatter()) {
      this.shatterAndRemove(hail);
    }
  }

  private handleOverlap(
    _playerGO: ArcadeOverlapObject,
    hailGO: ArcadeOverlapObject,
  ): void {
    const hail = this.byGameObject.get(hailGO as unknown as Phaser.GameObjects.GameObject);
    if (!hail || hail.isShattered()) return;

    const time = this.scene.time.now;
    if (!hail.canHitPlayer(time)) return;
    hail.markPlayerHit(time);

    this.onPlayerHit({
      hailstoneVelocityX: hail.getVelocityX(),
      hailstoneVelocityY: hail.getVelocityY(),
      hailstoneX: hail.getX(),
      hailstoneY: hail.getY(),
      playerX: this.player.getX(),
      playerY: this.player.getY(),
    });

    // A hit hailstone shatters too, so it never pinballs on the player.
    this.shatterAndRemove(hail);
  }

  private shatterAndRemove(hail: Hailstone): void {
    hail.markShattered();
    this.onShatter(hail.getX(), hail.getY());
    const index = this.hailstones.indexOf(hail);
    if (index !== -1) this.removeAt(index);
  }

  private removeAt(index: number): void {
    const hail = this.hailstones[index];
    this.byGameObject.delete(hail.getGameObject());
    this.hailstones.splice(index, 1);
    hail.destroy();
  }
}
