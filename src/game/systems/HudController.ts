import Phaser from "phaser";
import type { ScoreSnapshot } from "../types/gameTypes";
import { UI_CONFIG } from "../config/uiConfig";

const FONT = "monospace";

export class HudController {
  private readonly scene: Phaser.Scene;
  private readonly towerName: string;

  private scoreText!: Phaser.GameObjects.Text;
  private heightText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private towerNameText!: Phaser.GameObjects.Text;
  private pausedOverlay!: Phaser.GameObjects.Text;

  private readonly resizeHandler: () => void;

  constructor(scene: Phaser.Scene, towerName: string) {
    this.scene = scene;
    this.towerName = towerName;
    this.createElements();

    this.resizeHandler = () => { this.updateLayout(); };
    scene.scale.on("resize", this.resizeHandler);
  }

  update(snapshot: ScoreSnapshot, isPaused: boolean): void {
    this.scoreText.setText(`Score: ${snapshot.score}`);
    this.heightText.setText(`Height: ${snapshot.currentHeightMeters} m`);
    this.bestText.setText(`Best: ${snapshot.bestHeightMeters} m`);
    this.pausedOverlay.setVisible(isPaused);
  }

  setVisible(visible: boolean): void {
    for (const obj of [this.scoreText, this.heightText, this.bestText,
                        this.towerNameText, this.pausedOverlay]) {
      obj.setVisible(visible);
    }
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    for (const obj of [this.scoreText, this.heightText, this.bestText,
                        this.towerNameText, this.pausedOverlay]) {
      obj.destroy();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────

  private createElements(): void {
    const pad = UI_CONFIG.hudPadding;
    const lh  = UI_CONFIG.hudLineHeight;
    const W   = this.scene.scale.width;
    const H   = this.scene.scale.height;

    const textStyle = { fontSize: UI_CONFIG.hudFontSize, fontFamily: FONT, color: UI_CONFIG.hudTextColor };
    const dimStyle  = { fontSize: UI_CONFIG.hudFontSize, fontFamily: FONT, color: UI_CONFIG.hudDimColor };

    this.scoreText = this.scene.add.text(pad, pad,        "Score: 0",   textStyle);
    this.heightText = this.scene.add.text(pad, pad + lh,  "Height: 0 m", textStyle);
    this.bestText   = this.scene.add.text(pad, pad + lh * 2, "Best: 0 m", dimStyle);

    this.towerNameText = this.scene.add
      .text(W / 2, pad, this.towerName,
        { fontSize: UI_CONFIG.towerNameFontSize, fontFamily: FONT, color: UI_CONFIG.hudDimColor })
      .setOrigin(0.5, 0);

    this.pausedOverlay = this.scene.add
      .text(W / 2, H / 2, "PAUSED",
        {
          fontSize: UI_CONFIG.pauseOverlayFontSize,
          fontFamily: FONT,
          color: UI_CONFIG.pauseTextColor,
          stroke: "#000000",
          strokeThickness: 5,
        })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    // Apply scroll-factor and depth to all elements.
    const all = [this.scoreText, this.heightText, this.bestText,
                 this.towerNameText, this.pausedOverlay];
    for (const el of all) {
      el.setScrollFactor(0).setDepth(UI_CONFIG.hudDepth);
    }
  }

  updateLayout(): void {
    const W   = this.scene.scale.width;
    const H   = this.scene.scale.height;
    const pad = UI_CONFIG.hudPadding;
    const lh  = UI_CONFIG.hudLineHeight;

    this.scoreText.setPosition(pad, pad);
    this.heightText.setPosition(pad, pad + lh);
    this.bestText.setPosition(pad, pad + lh * 2);
    this.towerNameText.setPosition(W / 2, pad);
    this.pausedOverlay.setPosition(W / 2, H / 2);
  }
}
