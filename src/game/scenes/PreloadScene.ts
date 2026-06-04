import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GROUND_HEIGHT,
  PLATFORM_HEIGHT,
  PLAYER_FRAME_COUNT,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  SCENE_MAIN_MENU,
  SCENE_PRELOAD,
  TEX_GROUND,
  TEX_PLATFORM,
  TEX_PLATFORM_BREAKABLE,
  TEX_PLATFORM_GOAL,
  TEX_PLATFORM_MOVING,
  TEX_PLATFORM_SLIPPERY,
  TEX_PLAYER,
  TEX_PLAYER_LEFT,
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
// Final character sheets. Vite inlines these (~14 KB each) as base64 data URIs
// into the JS bundle (assetsInlineLimit in vite.config.ts), so there is no
// external request — required for YouTube Playables' single self-contained bundle.
import playerSheetUrl from "../assets/character/icytower_spritesheet.png";
import playerSheetLeftUrl from "../assets/character/icytower_spritesheet_left.png";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_PRELOAD });
  }

  preload(): void {
    // Real assets first; the generated fallback in create() only runs for keys
    // the loader did not produce (e.g. a load error). One frame size for both
    // facing sheets — they share the 48×64 / 12-frame layout.
    const frameConfig = {
      frameWidth: PLAYER_FRAME_WIDTH,
      frameHeight: PLAYER_FRAME_HEIGHT,
    };
    this.load.spritesheet(TEX_PLAYER, playerSheetUrl, frameConfig);
    this.load.spritesheet(TEX_PLAYER_LEFT, playerSheetLeftUrl, frameConfig);
  }

  create(): void {
    this.generatePlaceholderTextures();
    AnimationController.register(this);
    // Flow: Boot → Preload → MainMenu → Game (was Preload → Game directly).
    this.scene.start(SCENE_MAIN_MENU);
  }

  private generatePlaceholderTextures(): void {
    // Fallbacks for both facings — skipped when the real sheets loaded, since
    // each generator early-returns if its texture key already exists.
    this.createPlayerSpritesheet(TEX_PLAYER);
    this.createPlayerSpritesheet(TEX_PLAYER_LEFT);
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

  // ── Player spritesheet (generated fallback) ────────────────────────────
  // 12 frames × PLAYER_FRAME_WIDTH wide, PLAYER_FRAME_HEIGHT tall.
  // Layout: 0,1=idle  2-5=walk  6=jump  7=fall  8=land  9=hit  10,11=win
  // Only used when the real PNG sheet for `key` failed to load. It mirrors the
  // real frame size/count so AnimationController's 12-frame mapping never hits
  // a missing frame. Direction is irrelevant for a placeholder, so both the
  // right and left keys get the same drawing.

  private createPlayerSpritesheet(key: string): void {
    if (this.textures.exists(key)) return;

    const fw = PLAYER_FRAME_WIDTH;
    const fh = PLAYER_FRAME_HEIGHT;
    const totalW = fw * PLAYER_FRAME_COUNT;
    const g = this.make.graphics({ x: 0, y: 0 });

    for (let frame = 0; frame < PLAYER_FRAME_COUNT; frame++) {
      this.drawPlayerFrame(g, frame, frame * fw);
    }

    g.generateTexture(key, totalW, fh);
    g.destroy();

    // Slice the generated texture into individual animation frames.
    const tex = this.textures.get(key);
    for (let i = 0; i < PLAYER_FRAME_COUNT; i++) {
      tex.add(i, 0, i * fw, 0, fw, fh);
    }
  }

  // Draws one fallback animation frame at horizontal offset ox. Coordinates are
  // in the 48×64 frame; the character is centred (~x24) with feet near y=61 so
  // it lines up with the same physics body the real sheet uses.
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

    const cx = ox + 24; // frame centre

    // Head
    g.fillStyle(HEAD_COLOR, 1);
    g.fillRect(cx - 7, 12, 14, 14);

    // Eyes
    g.fillStyle(EYE_COLOR, 1);
    g.fillRect(cx - 4, 16, 3, 4);
    g.fillRect(cx + 2, 16, 3, 4);

    // Scarf
    g.fillStyle(SCARF_COLOR, 1);
    g.fillRect(cx - 9, 26, 18, 4);

    // Body
    g.fillStyle(BODY_COLOR, 1);
    g.fillRect(cx - 9, 30, 18, 18);

    // Legs + optional arm detail — varies by frame
    g.fillStyle(LEG_COLOR, 1);
    switch (frame) {
      case 0: // idle A
      case 1: // idle B
        g.fillRect(cx - 8, 48, 7, 13);
        g.fillRect(cx + 1, 48, 7, 13);
        break;

      case 2: // walk: lead left
        g.fillRect(cx - 12, 50, 7, 11);
        g.fillRect(cx + 4,  47, 7, 12);
        break;

      case 3: // walk: neutral
        g.fillRect(cx - 8, 48, 7, 13);
        g.fillRect(cx + 1, 48, 7, 13);
        break;

      case 4: // walk: lead right
        g.fillRect(cx - 11, 47, 7, 12);
        g.fillRect(cx + 5,  50, 7, 11);
        break;

      case 5: // walk: neutral
        g.fillRect(cx - 8, 48, 7, 13);
        g.fillRect(cx + 1, 48, 7, 13);
        break;

      case 6: // jump: legs together, arms raised
        g.fillRect(cx - 5, 48, 10, 13);
        g.fillStyle(BODY_COLOR, 1);
        g.fillRect(cx - 16, 28, 8, 5); // arm up
        g.fillRect(cx + 8,  28, 8, 5);
        break;

      case 7: // fall: legs spread, arms wide
        g.fillRect(cx - 10, 49, 7, 12);
        g.fillRect(cx + 3,  49, 7, 12);
        g.fillStyle(BODY_COLOR, 1);
        g.fillRect(cx - 18, 34, 9, 5); // arm out
        g.fillRect(cx + 9,  34, 9, 5);
        break;

      case 8: // land: compressed legs
        g.fillRect(cx - 9, 53, 8, 8);
        g.fillRect(cx + 1, 53, 8, 8);
        break;

      case 9: // hit: stagger, one arm flung
        g.fillRect(cx - 6, 49, 7, 12);
        g.fillRect(cx + 3, 50, 7, 11);
        g.fillStyle(BODY_COLOR, 1);
        g.fillRect(cx + 9, 32, 9, 5); // flung arm
        break;

      case 10: // win A: both arms up
      case 11: // win B
        g.fillRect(cx - 8, 48, 7, 13);
        g.fillRect(cx + 1, 48, 7, 13);
        g.fillStyle(BODY_COLOR, 1);
        g.fillRect(cx - 15, 24 + (frame === 10 ? 0 : 2), 7, 5);
        g.fillRect(cx + 8,  24 + (frame === 10 ? 0 : 2), 7, 5);
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
