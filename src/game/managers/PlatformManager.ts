import Phaser from "phaser";
import { Platform } from "../entities/Platform";
import type { MovingPlatformConfig, PlatformConfig, PlatformGenerationConfig, PlatformType, TowerPhaseConfig } from "../types/gameTypes";
import { PLATFORM_GEN_CONFIG } from "../config/platformGenerationConfig";
import {
  ICE_TOWER_GOAL_PLATFORM_WIDTH,
  ICE_TOWER_HEIGHT_METERS,
} from "../config/towerPhaseConfig";
import { getYFromHeightMeters } from "../utils/heightUtils";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_HEIGHT,
  MOVING_PLATFORM_MAX_RANGE,
  MOVING_PLATFORM_MAX_SPEED,
  MOVING_PLATFORM_MIN_RANGE,
  MOVING_PLATFORM_MIN_SPEED,
  REGIONAL_RENDER_ABOVE_BUFFER_PX,
  REGIONAL_RENDER_BELOW_BUFFER_PX,
  TEX_GROUND,
  WORLD_HEIGHT,
} from "../utils/constants";

// Callback that maps a platform's world Y position to its PlatformType.
// Provided by GameScene / TowerPhaseController to keep PlatformManager
// decoupled from phase configuration.
type PlatformTypeResolver = (platformY: number) => PlatformType;

export class PlatformManager {
  readonly platformGroup: Phaser.Physics.Arcade.StaticGroup;

  private readonly scene: Phaser.Scene;
  private readonly genConfig: PlatformGenerationConfig;
  private readonly platformTypeResolver: PlatformTypeResolver | null;

  // Active platforms — ground is tracked separately and never cleaned up.
  private platforms: Platform[] = [];

  // Y coordinate of the highest (lowest number) generated platform so far.
  private highestGeneratedY: number;

  // X center of the last generated platform — used for reachability checks.
  private lastPlatformCenterX: number;

  // Max horizontal distance the player can cover in a single jump arc.
  private readonly maxReachX: number;

  // ── Goal / summit state ──────────────────────────────────────────────────
  // World Y of the Ice Tower summit where the goal platform is placed.
  private readonly goalY: number;
  // The single goal platform, once generated. Never cleaned up.
  private goalPlatform: Platform | null = null;
  // True once the goal has been generated — stops all further generation.
  private hasGeneratedGoal = false;

  constructor(
    scene: Phaser.Scene,
    phase: TowerPhaseConfig,
    typeResolver?: PlatformTypeResolver,
  ) {
    this.scene = scene;
    this.genConfig = PLATFORM_GEN_CONFIG;
    this.platformTypeResolver = typeResolver ?? null;
    this.highestGeneratedY = WORLD_HEIGHT - GROUND_HEIGHT;
    this.lastPlatformCenterX = GAME_WIDTH / 2;
    this.goalY = getYFromHeightMeters(ICE_TOWER_HEIGHT_METERS);

    const fullAirTime =
      (2 * Math.abs(phase.playerJumpVelocity)) / phase.gravity;
    this.maxReachX =
      phase.playerMoveSpeed * fullAirTime * this.genConfig.airControlMultiplier;

    this.platformGroup = scene.physics.add.staticGroup();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  createInitialPlatforms(): void {
    this.createGround();
    for (let i = 0; i < this.genConfig.initialPlatformCount; i++) {
      this.generateNextPlatform();
    }
  }

  update(playerY: number, cameraScrollY: number, delta: number): void {
    const targetY = playerY - this.genConfig.generateAheadDistance;
    this.generatePlatformsUntil(targetY);
    this.updateRegionalVisibility(cameraScrollY);
    this.updatePlatforms(delta);
    this.cleanupFarPlatforms(cameraScrollY);
  }

  generatePlatformsUntil(targetY: number): void {
    // Once the goal exists the tower is "capped" — no platforms above it.
    while (!this.hasGeneratedGoal && this.highestGeneratedY > targetY) {
      this.generateNextPlatform();
    }
  }

  getHighestGeneratedY(): number {
    return this.highestGeneratedY;
  }

  // ── Goal queries ─────────────────────────────────────────────────────────

  isGoalGenerated(): boolean {
    return this.hasGeneratedGoal;
  }

  getGoalPlatform(): Platform | null {
    return this.goalPlatform;
  }

  createPlatform(config: PlatformConfig): Platform {
    const platform = new Platform(this.scene, config);
    this.platformGroup.add(platform.gameObject);
    this.platforms.push(platform);
    return platform;
  }

  // Looks up a Platform by its Phaser game object — used by the collision
  // callback in GameScene to identify the platform type the player touched.
  getPlatformByGameObject(go: Phaser.GameObjects.GameObject): Platform | undefined {
    return this.platforms.find((p) => p.gameObject === go);
  }

  // ── Procedural generation ──────────────────────────────────────────────

  private generateNextPlatform(): void {
    if (this.hasGeneratedGoal) return;

    // When the summit comes within a single max-jump of the highest platform,
    // place the goal instead of another normal platform. This guarantees the
    // final gap is at most maxVerticalGap (i.e. always reachable).
    if (this.shouldGenerateGoal()) {
      this.generateGoalPlatform();
      return;
    }

    const cfg = this.genConfig;

    const vertGap = Phaser.Math.Between(cfg.minVerticalGap, cfg.maxVerticalGap);
    const newY = this.highestGeneratedY - vertGap;

    const width = Phaser.Math.Between(cfg.minPlatformWidth, cfg.maxPlatformWidth);
    const halfWidth = width / 2;
    const minX = cfg.safeHorizontalPadding + halfWidth;
    const maxX = GAME_WIDTH - cfg.safeHorizontalPadding - halfWidth;

    let candidateX = Phaser.Math.Between(minX, maxX);
    let attempts = 0;

    while (
      !this.isPlatformReachable(this.lastPlatformCenterX, candidateX) &&
      attempts < cfg.maxGenerationAttempts
    ) {
      candidateX = Phaser.Math.Between(minX, maxX);
      attempts++;
    }

    if (!this.isPlatformReachable(this.lastPlatformCenterX, candidateX)) {
      const clampedX = Phaser.Math.Clamp(
        candidateX,
        this.lastPlatformCenterX - this.maxReachX,
        this.lastPlatformCenterX + this.maxReachX,
      );
      candidateX = Phaser.Math.Clamp(clampedX, minX, maxX);
    }

    // Ask the resolver for the type; fall back to normal if none provided.
    const type: PlatformType = this.platformTypeResolver
      ? this.platformTypeResolver(newY)
      : "normal";

    // For moving platforms, pre-compute oscillation bounds so Platform
    // doesn't need to know about world dimensions or gen config.
    let moving: MovingPlatformConfig | undefined;
    if (type === "moving") {
      const range    = Phaser.Math.Between(MOVING_PLATFORM_MIN_RANGE, MOVING_PLATFORM_MAX_RANGE);
      const halfRange = range / 2;
      moving = {
        speedPxPerSecond: Phaser.Math.Between(MOVING_PLATFORM_MIN_SPEED, MOVING_PLATFORM_MAX_SPEED),
        minX: Math.max(minX, candidateX - halfRange),
        maxX: Math.min(maxX, candidateX + halfRange),
      };
    }

    this.createPlatform({ x: candidateX, y: newY, width, type, moving });
    this.highestGeneratedY = newY;
    this.lastPlatformCenterX = candidateX;
  }

  isPlatformReachable(prevCenterX: number, candidateCenterX: number): boolean {
    return Math.abs(candidateCenterX - prevCenterX) <= this.maxReachX;
  }

  // ── Goal generation ────────────────────────────────────────────────────

  // True when the summit is within one max-jump of the highest platform, so
  // a goal placed at goalY is guaranteed to be vertically reachable.
  private shouldGenerateGoal(): boolean {
    return this.highestGeneratedY - this.goalY <= this.genConfig.maxVerticalGap;
  }

  // Places the single goal platform at the exact summit height. The X is the
  // last platform's center clamped within reach and world padding, so the
  // wide goal slab is always a fair final jump (no random retries).
  private generateGoalPlatform(): void {
    const cfg = this.genConfig;
    const width = ICE_TOWER_GOAL_PLATFORM_WIDTH;
    const halfWidth = width / 2;
    const minX = cfg.safeHorizontalPadding + halfWidth;
    const maxX = GAME_WIDTH - cfg.safeHorizontalPadding - halfWidth;

    const reachClampedX = Phaser.Math.Clamp(
      this.lastPlatformCenterX,
      this.lastPlatformCenterX - this.maxReachX,
      this.lastPlatformCenterX + this.maxReachX,
    );
    const goalX = Phaser.Math.Clamp(reachClampedX, minX, maxX);

    this.goalPlatform = this.createPlatform({
      x: goalX,
      y: this.goalY,
      width,
      type: "goal",
    });

    this.hasGeneratedGoal = true;
    this.highestGeneratedY = this.goalY;
    this.lastPlatformCenterX = goalX;
  }

  // ── Platform tick ──────────────────────────────────────────────────────

  private updatePlatforms(delta: number): void {
    let needsRefresh = false;
    for (const platform of this.platforms) {
      if (platform.update(delta)) {
        needsRefresh = true;
      }
    }
    if (needsRefresh) {
      this.platformGroup.refresh();
    }
  }

  // ── Regional visibility ────────────────────────────────────────────────

  private updateRegionalVisibility(cameraScrollY: number): void {
    const regionalTopY    = cameraScrollY - REGIONAL_RENDER_ABOVE_BUFFER_PX;
    const regionalBottomY = cameraScrollY + GAME_HEIGHT + REGIONAL_RENDER_BELOW_BUFFER_PX;

    for (const platform of this.platforms) {
      // Broken platforms are permanently disabled — never re-activate them.
      if (platform.isBroken()) {
        platform.gameObject.setVisible(false);
        (platform.gameObject.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        continue;
      }

      const y = platform.gameObject.y;
      const inRegion = y >= regionalTopY && y <= regionalBottomY;
      const body = platform.gameObject.body as Phaser.Physics.Arcade.StaticBody;

      platform.gameObject.setVisible(inRegion);
      body.enable = inRegion;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  private cleanupFarPlatforms(cameraScrollY: number): void {
    const destroyTopThreshold = cameraScrollY - REGIONAL_RENDER_ABOVE_BUFFER_PX * 3;
    let cleaned = false;

    this.platforms = this.platforms.filter((platform) => {
      // The goal platform is the tower's summit and must survive until restart,
      // even if it scrolls far off the top of the cleanup region.
      if (platform.isGoal()) return true;
      if (platform.gameObject.y < destroyTopThreshold) {
        this.platformGroup.remove(platform.gameObject, true, true);
        cleaned = true;
        return false;
      }
      return true;
    });

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
    // so it is excluded from visibility toggling, cleanup, and type lookup.
  }
}
