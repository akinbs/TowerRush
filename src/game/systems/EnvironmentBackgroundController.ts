import Phaser from "phaser";
import {
  ENV_ATMOSPHERE,
  ENV_COLORS,
  ENV_DEPTHS,
  ENV_LAYOUT,
  ENV_MOTE_COUNT,
  ENV_PARALLAX,
  ENV_TEX,
} from "../config/environmentConfig";

export interface EnvironmentBackgroundUpdateParams {
  scrollY: number;
  heightMeters: number;
}

// Parallax ice-tower backdrop: a static deep-navy gradient + a far aurora layer +
// mid ice-wall silhouettes (screen edges) + near crystal motes. Each moving layer
// is a TileSprite of a runtime-generated texture; update() only nudges
// tilePosition + alpha/tint, so there is no per-frame redraw. Renders entirely
// behind gameplay (negative depths) and never touches game state.
export class EnvironmentBackgroundController {
  private readonly scene: Phaser.Scene;

  private gradient!: Phaser.GameObjects.Image;
  private aurora!: Phaser.GameObjects.TileSprite;
  private wallLeft!: Phaser.GameObjects.TileSprite;
  private wallRight!: Phaser.GameObjects.TileSprite;
  private motes!: Phaser.GameObjects.TileSprite;

  private readonly resizeHandler: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.ensureTextures();
    this.createLayers();
    // Fallback so any sub-pixel gap during a resize reads as deep navy, not black.
    scene.cameras.main.setBackgroundColor(ENV_COLORS.deepNavy);
    this.layout(scene.scale.width, scene.scale.height);

    this.resizeHandler = () => this.layout(this.scene.scale.width, this.scene.scale.height);
    scene.scale.on("resize", this.resizeHandler);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  update(params: EnvironmentBackgroundUpdateParams): void {
    const { scrollY, heightMeters } = params;
    const now = this.scene.time.now;
    const a = ENV_ATMOSPHERE;

    // Parallax: smaller factor = further = slower drift. Climbing lowers scrollY,
    // which lowers tilePositionY → the layer drifts gently downward.
    this.aurora.tilePositionY = scrollY * ENV_PARALLAX.far;
    this.aurora.tilePositionX = Math.sin(now * a.driftSpeed) * a.auroraDriftAmp;
    this.wallLeft.tilePositionY = scrollY * ENV_PARALLAX.mid;
    this.wallRight.tilePositionY = scrollY * ENV_PARALLAX.mid;
    this.motes.tilePositionY = scrollY * ENV_PARALLAX.near;
    this.motes.tilePositionX = Math.sin(now * a.driftSpeed * 0.6) * a.moteDriftAmp;

    // Height atmosphere — aurora brightens + warms slightly toward the summit.
    const hf = Phaser.Math.Clamp(
      (heightMeters - a.heightTintStartMeters) / (a.heightTintFullMeters - a.heightTintStartMeters),
      0,
      1,
    );
    this.aurora.setAlpha(a.baseAuroraAlpha + hf * (a.maxAuroraAlpha - a.baseAuroraAlpha));
    this.aurora.setTint(this.lerpColor(0xffffff, a.summitTint, hf * a.summitTintStrength));
  }

  layout(width: number, height: number): void {
    this.gradient.setPosition(0, 0).setDisplaySize(width, height);
    this.aurora.setPosition(0, 0).setSize(width, height);
    this.motes.setPosition(0, 0).setSize(width, height);
    this.wallLeft.setPosition(0, 0).setSize(ENV_LAYOUT.wallWidth, height);
    this.wallRight.setPosition(width, 0).setSize(ENV_LAYOUT.wallWidth, height);
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    // Leave the generated textures cached for the next scene (ensureTextures
    // skips regeneration); just dispose this scene's display objects.
    this.gradient.destroy();
    this.aurora.destroy();
    this.wallLeft.destroy();
    this.wallRight.destroy();
    this.motes.destroy();
  }

  // ── Private — layers ───────────────────────────────────────────────────

  private createLayers(): void {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;

    this.gradient = s.add
      .image(0, 0, ENV_TEX.gradient)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(ENV_DEPTHS.background);

    this.aurora = s.add
      .tileSprite(0, 0, W, H, ENV_TEX.aurora)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(ENV_DEPTHS.aurora)
      .setAlpha(ENV_ATMOSPHERE.baseAuroraAlpha);

    this.wallLeft = s.add
      .tileSprite(0, 0, ENV_LAYOUT.wallWidth, H, ENV_TEX.wall)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(ENV_DEPTHS.towerSilhouette)
      .setAlpha(ENV_ATMOSPHERE.wallAlpha);

    this.wallRight = s.add
      .tileSprite(W, 0, ENV_LAYOUT.wallWidth, H, ENV_TEX.wall)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(ENV_DEPTHS.towerSilhouette)
      .setAlpha(ENV_ATMOSPHERE.wallAlpha);

    this.motes = s.add
      .tileSprite(0, 0, W, H, ENV_TEX.motes)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(ENV_DEPTHS.nearMotes)
      .setAlpha(ENV_ATMOSPHERE.moteAlpha);
  }

  // ── Private — texture generation (once; cached across restarts) ─────────

  private ensureTextures(): void {
    const t = this.scene.textures;
    if (!t.exists(ENV_TEX.gradient)) this.genGradient();
    if (!t.exists(ENV_TEX.aurora)) this.genAurora();
    if (!t.exists(ENV_TEX.wall)) this.genWall();
    if (!t.exists(ENV_TEX.motes)) this.genMotes();
  }

  // Off-display Graphics used only to bake a texture.
  private makeGraphics(): Phaser.GameObjects.Graphics {
    return this.scene.make.graphics({ x: 0, y: 0 }, false);
  }

  private genGradient(): void {
    const g = this.makeGraphics();
    g.fillGradientStyle(
      ENV_COLORS.deepBlue, ENV_COLORS.deepBlue,
      ENV_COLORS.deepNavy, ENV_COLORS.deepNavy,
      1,
    );
    g.fillRect(0, 0, 64, 256);
    g.generateTexture(ENV_TEX.gradient, 64, 256);
    g.destroy();
  }

  private genAurora(): void {
    const g = this.makeGraphics();
    this.drawBlob(g, 90, 110, 80, ENV_COLORS.iceCyan);
    this.drawBlob(g, 165, 245, 82, ENV_COLORS.auroraPurple);
    this.drawBlob(g, 110, 320, 55, ENV_COLORS.auroraGreen);
    g.generateTexture(ENV_TEX.aurora, ENV_LAYOUT.auroraTexW, ENV_LAYOUT.auroraTexH);
    g.destroy();
  }

  // Soft falloff blob: faint concentric fills, brighter toward the centre. Kept
  // within the tile margins so the texture tiles seamlessly.
  private drawBlob(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number): void {
    const rings = 5;
    for (let i = rings; i >= 1; i--) {
      g.fillStyle(color, 0.05);
      g.fillCircle(cx, cy, r * (i / rings));
    }
  }

  private genWall(): void {
    const g = this.makeGraphics();
    const w = ENV_LAYOUT.wallWidth;
    const h = ENV_LAYOUT.wallTexH;
    g.fillStyle(ENV_COLORS.deepBlue, 0.5);
    g.fillRect(0, 0, w, h);
    // Stacked ice blocks: a top highlight + a darker groove every 64px (tiles).
    for (let y = 0; y < h; y += 64) {
      g.fillStyle(ENV_COLORS.iceCyan, 0.1);
      g.fillRect(0, y, w, 3);
      g.fillStyle(ENV_COLORS.deepNavy, 0.3);
      g.fillRect(0, y + 56, w, 8);
    }
    // Faint vertical shards for column texture.
    g.fillStyle(ENV_COLORS.iceCyan, 0.06);
    g.fillRect(20, 0, 6, h);
    g.fillRect(58, 0, 4, h);
    g.generateTexture(ENV_TEX.wall, w, h);
    g.destroy();
  }

  private genMotes(): void {
    const g = this.makeGraphics();
    const size = ENV_LAYOUT.moteTexSize;
    const margin = 6;
    for (let i = 0; i < ENV_MOTE_COUNT; i++) {
      const x = margin + Math.random() * (size - margin * 2);
      const y = margin + Math.random() * (size - margin * 2);
      const r = 1.2 + Math.random() * 1.6;
      g.fillStyle(ENV_COLORS.frostWhite, 0.4 + Math.random() * 0.4);
      g.fillCircle(x, y, r);
    }
    g.generateTexture(ENV_TEX.motes, size, size);
    g.destroy();
  }

  // Linear blend between two 0xRRGGBB colours (t in 0..1).
  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }
}
