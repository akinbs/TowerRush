import Phaser from "phaser";
import { Platform } from "../entities/Platform";
import type { PlatformConfig, PlatformGenerationConfig, TowerPhaseConfig } from "../types/gameTypes";
import { PLATFORM_GEN_CONFIG } from "../config/platformGenerationConfig";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_HEIGHT,
  TEX_GROUND,
  WORLD_HEIGHT,
} from "../utils/constants";

export class PlatformManager {
  readonly platformGroup: Phaser.Physics.Arcade.StaticGroup;

  private readonly scene: Phaser.Scene;
  private readonly genConfig: PlatformGenerationConfig;

  // Active platforms — ground is tracked separately and never cleaned up.
  private platforms: Platform[] = [];

  // Y coordinate of the highest (lowest number) generated platform so far.
  // Starts at ground level; moves upward (decreasing) with each new platform.
  private highestGeneratedY: number;

  // X center of the last generated platform — used for reachability checks.
  private lastPlatformCenterX: number;

  // Max horizontal distance the player can cover in a single jump arc.
  private readonly maxReachX: number;

  constructor(scene: Phaser.Scene, phase: TowerPhaseConfig) {
    this.scene = scene;
    this.genConfig = PLATFORM_GEN_CONFIG;
    this.highestGeneratedY = WORLD_HEIGHT - GROUND_HEIGHT;
    this.lastPlatformCenterX = GAME_WIDTH / 2;

    // Theoretical max reach: full parabolic arc * speed * conservative multiplier.
    // Formula: moveSpeed × (2 × |jumpVelocity| / gravity) × airControlMultiplier
    const fullAirTime =
      (2 * Math.abs(phase.playerJumpVelocity)) / phase.gravity;
    this.maxReachX =
      phase.playerMoveSpeed * fullAirTime * this.genConfig.airControlMultiplier;

    this.platformGroup = scene.physics.add.staticGroup();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Creates ground + initial batch of procedural platforms. */
  createInitialPlatforms(): void {
    this.createGround();
    for (let i = 0; i < this.genConfig.initialPlatformCount; i++) {
      this.generateNextPlatform();
    }
  }

  /**
   * Called every frame by GameScene.
   * Generates ahead of the player and cleans up below the camera.
   */
  update(playerY: number, cameraScrollY: number): void {
    const targetY = playerY - this.genConfig.generateAheadDistance;
    this.generatePlatformsUntil(targetY);
    this.cleanupPlatforms(cameraScrollY);
  }

  /** Generate platforms until highestGeneratedY is at or above targetY. */
  generatePlatformsUntil(targetY: number): void {
    while (this.highestGeneratedY > targetY) {
      this.generateNextPlatform();
    }
  }

  /** Returns the Y of the topmost generated platform. */
  getHighestGeneratedY(): number {
    return this.highestGeneratedY;
  }

  // ── Platform creation ──────────────────────────────────────────────────

  /** Spawns one platform and registers it. */
  createPlatform(config: PlatformConfig): Platform {
    const platform = new Platform(this.scene, config);
    this.platformGroup.add(platform.gameObject);
    this.platforms.push(platform);
    return platform;
  }

  // ── Procedural generation ──────────────────────────────────────────────

  private generateNextPlatform(): void {
    const cfg = this.genConfig;

    const vertGap = Phaser.Math.Between(cfg.minVerticalGap, cfg.maxVerticalGap);
    const newY = this.highestGeneratedY - vertGap;

    const width = Phaser.Math.Between(cfg.minPlatformWidth, cfg.maxPlatformWidth);
    const halfWidth = width / 2;
    const minX = cfg.safeHorizontalPadding + halfWidth;
    const maxX = GAME_WIDTH - cfg.safeHorizontalPadding - halfWidth;

    let candidateX = Phaser.Math.Between(minX, maxX);
    let attempts = 0;

    // Try random candidates until one passes the reachability gate.
    while (
      !this.isPlatformReachable(this.lastPlatformCenterX, candidateX) &&
      attempts < cfg.maxGenerationAttempts
    ) {
      candidateX = Phaser.Math.Between(minX, maxX);
      attempts++;
    }

    // Fallback: clamp to the reachable range around the last platform.
    if (!this.isPlatformReachable(this.lastPlatformCenterX, candidateX)) {
      const clampedX = Phaser.Math.Clamp(
        candidateX,
        this.lastPlatformCenterX - this.maxReachX,
        this.lastPlatformCenterX + this.maxReachX,
      );
      candidateX = Phaser.Math.Clamp(clampedX, minX, maxX);
    }

    this.createPlatform({ x: candidateX, y: newY, width, type: "normal" });
    this.highestGeneratedY = newY;
    this.lastPlatformCenterX = candidateX;
  }

  /**
   * Returns true when the horizontal gap between platforms is within
   * the player's maximum aerial reach.
   */
  isPlatformReachable(prevCenterX: number, candidateCenterX: number): boolean {
    return Math.abs(candidateCenterX - prevCenterX) <= this.maxReachX;
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  /**
   * Destroys platforms that have scrolled far below the camera's bottom edge.
   * The ground image is NOT in `platforms[]` and is never cleaned up.
   */
  cleanupPlatforms(cameraScrollY: number): void {
    const threshold = cameraScrollY + GAME_HEIGHT + this.genConfig.cleanupBelowDistance;
    let cleaned = false;

    this.platforms = this.platforms.filter((platform) => {
      if (platform.gameObject.y > threshold) {
        // Remove from static group first so the physics quadtree is updated,
        // then destroy the game object (which also destroys the StaticBody).
        this.platformGroup.remove(platform.gameObject, true, true);
        cleaned = true;
        return false;
      }
      return true;
    });

    // Force a quadtree rebuild after any removals so collision stays correct.
    if (cleaned) {
      this.platformGroup.refresh();
    }
  }

  // ── Ground ─────────────────────────────────────────────────────────────

  private createGround(): void {
    const groundY = WORLD_HEIGHT - GROUND_HEIGHT / 2;
    const groundX = GAME_WIDTH / 2;

    const groundImg = this.scene.physics.add.staticImage(groundX, groundY, TEX_GROUND);
    groundImg.setDisplaySize(GAME_WIDTH, GROUND_HEIGHT);

    const body = groundImg.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(GAME_WIDTH, GROUND_HEIGHT);
    body.reset(groundX, groundY);

    this.platformGroup.add(groundImg);
    // Note: groundImg is intentionally NOT added to `this.platforms[]`
    // so it is excluded from the cleanup pass.
  }
}
