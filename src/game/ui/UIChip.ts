import Phaser from "phaser";
import {
  UI_ALPHA,
  UI_COLORS,
  UI_FONT,
  UI_MOTION,
  UI_RADIUS,
  UI_SPACING,
  UI_STROKE,
  toCss,
} from "../config/uiTokens";

export interface UIChipOptions {
  width?: number;
  height?: number;
  accent?: number; // value text color (defaults to ice)
}

// Small info pill. Two modes:
//   • labelled  → dim left label + bright right value ("BEST   1234")
//   • centered  → single centered value (pass label === ""), used as a badge
// setValue() updates the value (optionally with a bump) without reflowing, since
// label/value are anchored to fixed positions.
export class UIChip extends Phaser.GameObjects.Container {
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly boxW: number;
  private readonly boxH: number;
  private readonly centered: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    initialValue: string,
    options: UIChipOptions = {},
  ) {
    super(scene, x, y);
    this.boxW = options.width ?? 116;
    this.boxH = options.height ?? 34;
    this.centered = label === "";
    const accent = options.accent ?? UI_COLORS.ice;

    const bg = scene.add.graphics();
    bg.fillStyle(UI_COLORS.panelSoft, UI_ALPHA.panelSoft);
    bg.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, UI_RADIUS.chip);
    bg.lineStyle(UI_STROKE.hair, UI_COLORS.border, 0.4);
    bg.strokeRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, UI_RADIUS.chip);

    this.labelText = scene.add
      .text(-this.boxW / 2 + UI_SPACING.md, 0, label, {
        fontFamily: UI_FONT.body,
        fontSize: "12px",
        fontStyle: "bold",
        color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0, 0.5)
      .setVisible(!this.centered);

    this.valueText = scene.add
      .text(this.centered ? 0 : this.boxW / 2 - UI_SPACING.md, 0, initialValue, {
        fontFamily: UI_FONT.mono,
        fontSize: this.centered ? "15px" : "16px",
        fontStyle: "bold",
        color: toCss(accent),
      })
      .setOrigin(this.centered ? 0.5 : 1, 0.5);

    this.add([bg, this.labelText, this.valueText]);
    this.setScrollFactor(0);
    scene.add.existing(this);
  }

  setValue(value: string, bump = false): this {
    this.valueText.setText(value);
    if (bump) this.bump();
    return this;
  }

  bump(): this {
    this.valueText.setScale(1);
    this.scene.tweens.add({
      targets: this.valueText,
      scale: 1.18,
      duration: UI_MOTION.chipBumpMs / 2,
      yoyo: true,
      ease: "Back.easeOut",
    });
    return this;
  }

  setLabel(label: string): this {
    this.labelText.setText(label);
    return this;
  }

  setAccentColor(color: number): this {
    this.valueText.setColor(toCss(color));
    return this;
  }
}
