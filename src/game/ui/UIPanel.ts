import Phaser from "phaser";
import {
  UI_ALPHA,
  UI_COLORS,
  UI_FONT,
  UI_RADIUS,
  UI_SPACING,
  UI_STROKE,
  toCss,
} from "../config/uiTokens";

export interface UIPanelOptions {
  width: number;
  height: number;
  title?: string;
  depth?: number;
}

// Glass/ice modal panel: a rounded translucent Graphics body + soft border +
// optional title. Consumers add their own content as children of this Container.
export class UIPanel extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: UIPanelOptions) {
    super(scene, x, y);
    const { width, height, title } = options;

    const bg = scene.add.graphics();
    bg.fillStyle(UI_COLORS.panel, UI_ALPHA.panel);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, UI_RADIUS.panel);
    bg.lineStyle(UI_STROKE.base, UI_COLORS.border, 0.55);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, UI_RADIUS.panel);
    this.add(bg);

    if (title) {
      const titleText = scene.add
        .text(0, -height / 2 + UI_SPACING.lg, title, {
          fontFamily: UI_FONT.display,
          fontSize: "22px",
          fontStyle: "bold",
          color: toCss(UI_COLORS.textPrimary),
        })
        .setOrigin(0.5, 0);
      this.add(titleText);
    }

    this.setScrollFactor(0);
    if (options.depth !== undefined) this.setDepth(options.depth);

    scene.add.existing(this);
  }
}
