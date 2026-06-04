import Phaser from "phaser";
import {
  UI_ALPHA,
  UI_COLORS,
  UI_MOTION,
  UI_STROKE,
  UI_TOUCH,
} from "../config/uiTokens";

// Icons are drawn with Graphics (no fonts/emoji/assets) for reliable rendering
// across mobile webviews.
export type UIIconName = "sound-on" | "sound-off" | "gear" | "close" | "pause" | "play";

export interface UIIconButtonOptions {
  size?: number; // touch diameter (>= UI_TOUCH.min)
}

// Small circular icon button (sound toggle, settings, close). Generated glyphs.
export class UIIconButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Graphics;
  private readonly size: number;
  private readonly onClick: () => void;

  private iconName: UIIconName;
  private enabledState = true;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    iconName: UIIconName,
    onClick: () => void,
    options: UIIconButtonOptions = {},
  ) {
    super(scene, x, y);
    this.onClick = onClick;
    this.iconName = iconName;
    this.size = Math.max(UI_TOUCH.min, options.size ?? UI_TOUCH.min);

    this.bg = scene.add.graphics();
    this.icon = scene.add.graphics();
    this.add([this.bg, this.icon]);
    this.drawBackground();
    this.drawIcon();

    this.setSize(this.size, this.size);
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, this.size / 2),
      Phaser.Geom.Circle.Contains,
    );
    this.input!.cursor = "pointer";

    this.on("pointerdown", this.handleDown, this);
    this.on("pointerup", this.handleUp, this);
    this.on("pointerout", this.handleOut, this);

    scene.add.existing(this);
  }

  setIcon(iconName: UIIconName): this {
    this.iconName = iconName;
    this.drawIcon();
    return this;
  }

  setEnabledState(enabled: boolean): this {
    if (this.enabledState === enabled) return this;
    this.enabledState = enabled;
    this.setAlpha(enabled ? 1 : UI_ALPHA.disabled);
    if (enabled) {
      this.setInteractive();
    } else {
      this.disableInteractive();
      this.pressed = false;
      this.setScale(1);
    }
    return this;
  }

  // ── Private: input ───────────────────────────────────────────────────────

  private handleDown(): void {
    if (!this.enabledState) return;
    this.pressed = true;
    this.scene.tweens.add({
      targets: this,
      scale: 0.92,
      duration: UI_MOTION.buttonPressMs,
      ease: "Cubic.easeOut",
    });
  }

  private handleUp(): void {
    if (!this.enabledState || !this.pressed) return;
    this.pressed = false;
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      duration: UI_MOTION.buttonPressMs,
      ease: "Back.easeOut",
    });
    this.onClick();
  }

  private handleOut(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.scene.tweens.add({ targets: this, scale: 1, duration: UI_MOTION.buttonPressMs });
  }

  // ── Private: drawing ─────────────────────────────────────────────────────

  private drawBackground(): void {
    const r = this.size / 2;
    this.bg.clear();
    this.bg.fillStyle(UI_COLORS.panelSoft, UI_ALPHA.panel);
    this.bg.fillCircle(0, 0, r);
    this.bg.lineStyle(UI_STROKE.base, UI_COLORS.border, 0.5);
    this.bg.strokeCircle(0, 0, r - 1);
  }

  private drawIcon(): void {
    const g = this.icon;
    const c = UI_COLORS.textPrimary;
    const u = this.size * 0.14; // base icon unit
    g.clear();

    switch (this.iconName) {
      case "sound-on":
        this.drawSpeaker(g, c, u);
        g.lineStyle(this.size * 0.05, c, 1);
        this.drawWave(g, u * 0.6, u * 1.1);
        this.drawWave(g, u * 0.6, u * 1.8);
        break;

      case "sound-off":
        this.drawSpeaker(g, c, u);
        g.lineStyle(this.size * 0.05, UI_COLORS.danger, 1);
        g.lineBetween(u * 1.0, -u * 0.9, u * 2.2, u * 0.9);
        g.lineBetween(u * 2.2, -u * 0.9, u * 1.0, u * 0.9);
        break;

      case "gear":
        g.lineStyle(this.size * 0.08, c, 1);
        g.strokeCircle(0, 0, u * 1.4);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          g.lineBetween(
            Math.cos(a) * u * 1.4, Math.sin(a) * u * 1.4,
            Math.cos(a) * u * 2.1, Math.sin(a) * u * 2.1,
          );
        }
        g.fillStyle(c, 1);
        g.fillCircle(0, 0, u * 0.55);
        break;

      case "close":
        g.lineStyle(this.size * 0.09, c, 1);
        g.lineBetween(-u * 1.3, -u * 1.3, u * 1.3, u * 1.3);
        g.lineBetween(u * 1.3, -u * 1.3, -u * 1.3, u * 1.3);
        break;

      case "pause": {
        g.fillStyle(c, 1);
        const barW = u * 0.6;
        const barH = u * 2.4;
        const gap = u * 0.55;
        g.fillRect(-gap - barW, -barH / 2, barW, barH);
        g.fillRect(gap, -barH / 2, barW, barH);
        break;
      }

      case "play":
        g.fillStyle(c, 1);
        g.fillTriangle(-u * 0.9, -u * 1.4, -u * 0.9, u * 1.4, u * 1.5, 0);
        break;
    }
  }

  // Speaker body: back box + cone, centred slightly left.
  private drawSpeaker(g: Phaser.GameObjects.Graphics, color: number, u: number): void {
    g.fillStyle(color, 1);
    g.fillRect(-u * 2.2, -u * 0.7, u, u * 1.4);
    g.fillTriangle(-u * 1.2, -u * 1.3, -u * 1.2, u * 1.3, u * 0.3, 0);
  }

  private drawWave(g: Phaser.GameObjects.Graphics, cx: number, radius: number): void {
    g.beginPath();
    g.arc(cx, 0, radius, -0.7, 0.7);
    g.strokePath();
  }
}
