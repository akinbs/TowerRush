import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GROUND_HEIGHT,
  PLATFORM_HEIGHT,
  PLAYER_FRAME_COUNT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SCENE_GAME,
  SCENE_PRELOAD,
  TEX_GROUND,
  TEX_PLATFORM,
  TEX_PLATFORM_BREAKABLE,
  TEX_PLATFORM_GOAL,
  TEX_PLATFORM_MOVING,
  TEX_PLATFORM_SLIPPERY,
  TEX_PLAYER,
  TEX_PROJECTILE,
  TEX_HAILSTONE_PREFIX,
} from "../utils/constants";
import {
  ICE_TOWER_GOAL_PLATFORM_HEIGHT,
  ICE_TOWER_GOAL_PLATFORM_WIDTH,
} from "../config/towerPhaseConfig";
import { HAZARD_CONFIG } from "../config/hazardConfig";
import { SNOW_CONFIG } from "../config/snowConfig";
import { AnimationController } from "../systems/AnimationController";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_PRELOAD });
  }

  create(): void {
    this.generatePlaceholderTextures();
    AnimationController.register(this);
    this.scene.start(SCENE_GAME);
  }

  private generatePlaceholderTextures(): void {
    this.createPlayerSpritesheet();
    this.createRectTexture(TEX_PLATFORM, 100, PLATFORM_HEIGHT, 0x88ccff);
    this.createRectTexture(TEX_PLATFORM_SLIPPERY, 100, PLATFORM_HEIGHT, 0x22eeff);
    this.createBreakablePlatformTexture();
    this.createMovingPlatformTexture();
    this.createGoalPlatformTexture();
    this.createRectTexture(TEX_GROUND, GAME_HEIGHT, GROUND_HEIGHT, 0x5599cc);
    this.createProjectileTexture();
    this.createHailstoneTextures();
  }

  // ── Hailstone textures ─────────────────────────────────────────────────
  // One filled-circle texture per integer radius so the Arcade circle body
  // (setCircle(radius)) always matches the sprite without any scaling.

  private createHailstoneTextures(): void {
    const h = SNOW_CONFIG.hail;
    for (let r = h.radiusMin; r <= h.radiusMax; r++) {
      const key = `${TEX_HAILSTONE_PREFIX}${r}`;
      if (this.textures.exists(key)) continue;

      const d = r * 2;
      const g = this.make.graphics({ x: 0, y: 0 });

      // Brighter / whiter than the small projectile so hail reads as chunkier ice.
      g.fillStyle(0xddf2ff, 1);
      g.fillCircle(r, r, r);

      g.lineStyle(1.5, 0x2a5a8a, 1);
      g.strokeCircle(r, r, r - 0.75);

      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(r - r * 0.3, r - r * 0.3, Math.max(1, r * 0.3));

      g.generateTexture(key, d, d);
      g.destroy();
    }
  }

  // ── Projectile texture ─────────────────────────────────────────────────
  // Icy ball: blue fill, dark rim, small offset highlight. Size = 2·radius so
  // Projectile's body.setCircle(radius) centres with zero offset.

  private createProjectileTexture(): void {
    if (this.textures.exists(TEX_PROJECTILE)) return;

    const r = HAZARD_CONFIG.sideProjectile.radius;
    const d = r * 2;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Small bright ice ball with a thin dark outline so it stays readable even
    // at a 7px radius against the platforms and background.
    g.fillStyle(0x99e0ff, 1);
    g.fillCircle(r, r, r);

    g.lineStyle(1.5, 0x12345a, 1);
    g.strokeCircle(r, r, r - 0.75);

    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(r - r * 0.3, r - r * 0.3, Math.max(1.2, r * 0.32));

    g.generateTexture(TEX_PROJECTILE, d, d);
    g.destroy();
  }

  // ── Player spritesheet ─────────────────────────────────────────────────
  // 7 frames × PLAYER_WIDTH wide, PLAYER_HEIGHT tall.
  // Frame layout: 0=idle  1-4=walk  5=jump  6=fall

  private createPlayerSpritesheet(): void {
    if (this.textures.exists(TEX_PLAYER)) return;

    const totalW = PLAYER_WIDTH * PLAYER_FRAME_COUNT;
    const g = this.make.graphics({ x: 0, y: 0 });

    for (let frame = 0; frame < PLAYER_FRAME_COUNT; frame++) {
      this.drawPlayerFrame(g, frame, frame * PLAYER_WIDTH);
    }

    g.generateTexture(TEX_PLAYER, totalW, PLAYER_HEIGHT);
    g.destroy();

    // Slice the generated texture into individual animation frames.
    const tex = this.textures.get(TEX_PLAYER);
    for (let i = 0; i < PLAYER_FRAME_COUNT; i++) {
      tex.add(i, 0, i * PLAYER_WIDTH, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
    }
  }

  // Draws one animation frame at horizontal offset ox on the given graphics object.
  private drawPlayerFrame(
    g: Phaser.GameObjects.Graphics,
    frame: number,
    ox: number,
  ): void {
    const HEAD_COLOR  = 0x2277cc;
    const BODY_COLOR  = 0x44aaff;
    const LEG_COLOR   = 0x1a5599;
    const EYE_COLOR   = 0xffffff;
    const SCARF_COLOR = 0xee3333;

    // Head
    g.fillStyle(HEAD_COLOR, 1);
    g.fillRect(ox + 11, 2, 10, 11);

    // Eyes
    g.fillStyle(EYE_COLOR, 1);
    g.fillRect(ox + 13, 4, 2, 3);
    g.fillRect(ox + 17, 4, 2, 3);

    // Scarf
    g.fillStyle(SCARF_COLOR, 1);
    g.fillRect(ox + 9, 12, 14, 3);

    // Body
    g.fillStyle(BODY_COLOR, 1);
    g.fillRect(ox + 9, 15, 14, 16);

    // Legs + optional arm detail — varies by frame
    g.fillStyle(LEG_COLOR, 1);
    switch (frame) {
      case 0: // idle: legs straight, side by side
        g.fillRect(ox + 9,  31, 6, 15);
        g.fillRect(ox + 17, 31, 6, 15);
        break;

      case 1: // walk A: left leg forward, right leg back
        g.fillRect(ox + 6,  33, 6, 13);
        g.fillRect(ox + 20, 30, 6, 14);
        break;

      case 2: // walk B: neutral (same as idle)
        g.fillRect(ox + 9,  31, 6, 15);
        g.fillRect(ox + 17, 31, 6, 15);
        break;

      case 3: // walk C: right leg forward, left leg back
        g.fillRect(ox + 6,  30, 6, 14);
        g.fillRect(ox + 20, 33, 6, 13);
        break;

      case 4: // walk D: neutral
        g.fillRect(ox + 9,  31, 6, 15);
        g.fillRect(ox + 17, 31, 6, 15);
        break;

      case 5: // jump: legs together, arms raised
        g.fillRect(ox + 11, 32, 10, 14); // merged legs
        g.fillStyle(BODY_COLOR, 1);
        g.fillRect(ox + 2,  14, 7, 4);   // left arm up
        g.fillRect(ox + 23, 14, 7, 4);   // right arm up
        break;

      case 6: // fall: legs V-spread, arms wide
        g.fillRect(ox + 7,  33, 6, 13);
        g.fillRect(ox + 19, 33, 6, 13);
        g.fillStyle(BODY_COLOR, 1);
        g.fillRect(ox + 1,  20, 8, 4);   // left arm out
        g.fillRect(ox + 23, 20, 8, 4);   // right arm out
        break;
    }
  }

  // ── Platform textures ──────────────────────────────────────────────────

  private createBreakablePlatformTexture(): void {
    if (this.textures.exists(TEX_PLATFORM_BREAKABLE)) return;

    const w = 100;
    const h = PLATFORM_HEIGHT;
    const g = this.make.graphics({ x: 0, y: 0 });

    g.fillStyle(0xbbeeff, 1);
    g.fillRect(0, 0, w, h);

    g.lineStyle(1.5, 0x224488, 0.85);
    g.beginPath();
    g.moveTo(18, 0);  g.lineTo(8,  h);
    g.moveTo(50, 0);  g.lineTo(38, h);
    g.moveTo(80, 0);  g.lineTo(68, h);
    g.strokePath();

    g.generateTexture(TEX_PLATFORM_BREAKABLE, w, h);
    g.destroy();
  }

  private createMovingPlatformTexture(): void {
    if (this.textures.exists(TEX_PLATFORM_MOVING)) return;

    const w = 100;
    const h = PLATFORM_HEIGHT;
    const g = this.make.graphics({ x: 0, y: 0 });

    g.fillStyle(0x2255bb, 1);
    g.fillRect(0, 0, w, h);

    g.lineStyle(1.5, 0x99ccff, 0.9);
    const midY = h / 2;
    for (const ax of [14, 44, 74]) {
      g.beginPath();
      g.moveTo(ax,      midY);
      g.lineTo(ax + 14, midY);
      g.moveTo(ax + 11, midY - 3);
      g.lineTo(ax + 14, midY);
      g.lineTo(ax + 11, midY + 3);
      g.strokePath();
    }

    g.generateTexture(TEX_PLATFORM_MOVING, w, h);
    g.destroy();
  }

  // ── Goal platform texture ──────────────────────────────────────────────
  // Wide, bright white/gold ice slab with a small star mark in the centre so
  // it reads as the climb's destination and is unmistakable against the blue
  // ice platforms below it.
  private createGoalPlatformTexture(): void {
    if (this.textures.exists(TEX_PLATFORM_GOAL)) return;

    const w = ICE_TOWER_GOAL_PLATFORM_WIDTH;
    const h = ICE_TOWER_GOAL_PLATFORM_HEIGHT;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Pale gold-ice base.
    g.fillStyle(0xfff4cc, 1);
    g.fillRect(0, 0, w, h);

    // Bright top highlight strip — catches the eye from below.
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, w, 4);

    // Gold rim.
    g.lineStyle(2, 0xffcc44, 1);
    g.strokeRect(1, 1, w - 2, h - 2);

    // Centre star mark.
    const cx = w / 2;
    const cy = h / 2;
    g.fillStyle(0xffaa00, 1);
    g.beginPath();
    g.moveTo(cx, cy - 6);
    g.lineTo(cx + 2, cy - 1);
    g.lineTo(cx + 7, cy - 1);
    g.lineTo(cx + 3, cy + 2);
    g.lineTo(cx + 5, cy + 6);
    g.lineTo(cx, cy + 3);
    g.lineTo(cx - 5, cy + 6);
    g.lineTo(cx - 3, cy + 2);
    g.lineTo(cx - 7, cy - 1);
    g.lineTo(cx - 2, cy - 1);
    g.closePath();
    g.fillPath();

    g.generateTexture(TEX_PLATFORM_GOAL, w, h);
    g.destroy();
  }

  private createRectTexture(key: string, w: number, h: number, color: number): void {
    if (this.textures.exists(key)) return;

    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
