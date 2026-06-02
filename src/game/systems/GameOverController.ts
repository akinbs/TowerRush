import Phaser from "phaser";
import type { ScoreSnapshot } from "../types/gameTypes";
import { UI_CONFIG } from "../config/uiConfig";

const FONT = "monospace";

export class GameOverController {
  private readonly scene: Phaser.Scene;

  private overlay!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private restartText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Rectangle;
  private restartBtnLabel!: Phaser.GameObjects.Text;

  private isVisible = false;
  private restartPressed = false;

  private readonly resizeHandler: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createElements();

    this.resizeHandler = () => { this.updateLayout(); };
    scene.scale.on("resize", this.resizeHandler);
  }

  show(snapshot: ScoreSnapshot): void {
    this.isVisible = true;
    this.restartPressed = false;

    this.scoreText.setText(`Height: ${snapshot.bestHeightMeters} m`);
    this.bestText.setText(`Score: ${snapshot.score}`);

    for (const obj of this.allObjects()) {
      obj.setVisible(true);
    }
  }

  hide(): void {
    this.isVisible = false;
    for (const obj of this.allObjects()) {
      obj.setVisible(false);
    }
  }

  // Returns true once per restart button tap — consumed on read.
  consumeRestartPressed(): boolean {
    const v = this.restartPressed;
    this.restartPressed = false;
    return v;
  }

  getIsVisible(): boolean { return this.isVisible; }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    for (const obj of this.allObjects()) {
      obj.destroy();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────

  private createElements(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const depth = UI_CONFIG.gameOverDepth;

    this.overlay = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0x000033)
      .setScrollFactor(0)
      .setAlpha(UI_CONFIG.gameOverBgAlpha)
      .setDepth(depth);

    this.titleText = this.scene.add
      .text(W / 2, H * 0.28, "GAME OVER", {
        fontSize: "38px", fontFamily: FONT, color: "#ff4444",
        stroke: "#000000", strokeThickness: 5,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.scoreText = this.scene.add
      .text(W / 2, H * 0.42, "Height: 0 m", {
        fontSize: "20px", fontFamily: FONT, color: "#e8e8ff",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.bestText = this.scene.add
      .text(W / 2, H * 0.50, "Score: 0", {
        fontSize: "20px", fontFamily: FONT, color: "#ffdd44",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.restartBtn = this.scene.add
      .rectangle(W / 2, H * 0.65, 180, 52, 0x224422)
      .setScrollFactor(0)
      .setAlpha(0.9)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => { this.restartPressed = true; })
      .on("pointerover", () => { this.restartBtn.setFillStyle(0x448844); })
      .on("pointerout",  () => { this.restartBtn.setFillStyle(0x224422); });

    this.restartBtnLabel = this.scene.add
      .text(W / 2, H * 0.65, "RESTART", {
        fontSize: "18px", fontFamily: FONT, color: "#aaffaa",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.restartText = this.scene.add
      .text(W / 2, H * 0.76, "or press  R", {
        fontSize: "13px", fontFamily: FONT, color: "#9999bb",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    for (const obj of this.allObjects()) {
      obj.setVisible(false);
    }
  }

  private updateLayout(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    this.overlay.setPosition(W / 2, H / 2).setSize(W, H);
    this.titleText.setPosition(W / 2, H * 0.28);
    this.scoreText.setPosition(W / 2, H * 0.42);
    this.bestText.setPosition(W / 2, H * 0.50);
    this.restartBtn.setPosition(W / 2, H * 0.65);
    this.restartBtnLabel.setPosition(W / 2, H * 0.65);
    this.restartText.setPosition(W / 2, H * 0.76);
  }

  private allObjects(): (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] {
    return [
      this.overlay, this.titleText, this.scoreText, this.bestText,
      this.restartBtn, this.restartBtnLabel, this.restartText,
    ];
  }
}
