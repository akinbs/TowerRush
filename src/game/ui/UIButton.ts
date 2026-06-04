import Phaser from "phaser";
import {
  UI_ALPHA,
  UI_COLORS,
  UI_FONT,
  UI_MOTION,
  UI_RADIUS,
  UI_STROKE,
  UI_TOUCH,
  toCss,
} from "../config/uiTokens";

export type UIButtonVariant = "primary" | "secondary" | "danger";

export interface UIButtonOptions {
  width?: number;
  height?: number;
  variant?: UIButtonVariant;
  fontSize?: number;
}

// Reusable primitive button: a Container of a rounded Graphics background + a
// centered Text label. No DOM, no external font. Press feedback = scale 0.94.
export class UIButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly variant: UIButtonVariant;
  private readonly boxW: number;
  private readonly boxH: number;
  private readonly onClick: () => void;

  private enabledState = true;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    options: UIButtonOptions = {},
  ) {
    super(scene, x, y);
    this.onClick = onClick;
    this.boxW = options.width ?? 200;
    this.boxH = options.height ?? Math.max(UI_TOUCH.min, 52);
    this.variant = options.variant ?? "primary";

    this.bg = scene.add.graphics();
    this.labelText = scene.add
      .text(0, 0, label, {
        fontFamily: UI_FONT.body,
        fontSize: `${options.fontSize ?? 18}px`,
        fontStyle: "bold",
        color: toCss(this.labelColor()),
      })
      .setOrigin(0.5);

    this.add([this.bg, this.labelText]);
    this.redraw();

    this.setSize(this.boxW, this.boxH);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input!.cursor = "pointer";

    this.on("pointerdown", this.handleDown, this);
    this.on("pointerup", this.handleUp, this);
    this.on("pointerout", this.handleOut, this);

    scene.add.existing(this);
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

  // ── Private ────────────────────────────────────────────────────────────

  private handleDown(): void {
    if (!this.enabledState) return;
    this.pressed = true;
    this.scene.tweens.add({
      targets: this,
      scale: 0.94,
      duration: UI_MOTION.buttonPressMs,
      ease: "Cubic.easeOut",
    });
  }

  private handleUp(): void {
    if (!this.enabledState || !this.pressed) return;
    this.pressed = false;
    this.springBack("Back.easeOut");
    this.onClick();
  }

  private handleOut(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.springBack("Cubic.easeOut");
  }

  private springBack(ease: string): void {
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      duration: UI_MOTION.buttonPressMs,
      ease,
    });
  }

  private redraw(): void {
    const r = UI_RADIUS.button;
    const { fill, fillAlpha, stroke } = this.variantStyle();
    this.bg.clear();
    this.bg.fillStyle(fill, fillAlpha);
    this.bg.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, r);
    this.bg.lineStyle(UI_STROKE.bold, stroke, 0.7);
    this.bg.strokeRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, r);
  }

  private variantStyle(): { fill: number; fillAlpha: number; stroke: number } {
    switch (this.variant) {
      case "primary":
        return { fill: UI_COLORS.ice, fillAlpha: 0.95, stroke: UI_COLORS.border };
      case "danger":
        return { fill: UI_COLORS.danger, fillAlpha: 0.95, stroke: UI_COLORS.danger };
      case "secondary":
      default:
        return { fill: UI_COLORS.panelSoft, fillAlpha: UI_ALPHA.panel, stroke: UI_COLORS.border };
    }
  }

  // Bright fills (primary/danger) take a dark label; the glass secondary takes light.
  private labelColor(): number {
    return this.variant === "secondary" ? UI_COLORS.textPrimary : UI_COLORS.backgroundPrimary;
  }
}
