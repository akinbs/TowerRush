import Phaser from "phaser";
import type { ScoreSnapshot } from "../types/gameTypes";
import { UI_CONFIG } from "../config/uiConfig";

const FONT = "monospace";

// Functional (not polished) overlay shown when the player reaches the Ice
// Tower summit goal platform. Mirrors GameOverController's lifecycle so
// GameScene can drive both the same way:
//   create() in constructor → show(snapshot) → consume*Pressed() → destroy()
//
// "Next Tower" is intentionally a disabled placeholder this step: the second
// tower does not exist yet, so consumeContinuePressed() exists for future
// wiring but always reports false (the button is non-interactive).
export class TowerCompletionController {
  private readonly scene: Phaser.Scene;

  private overlay!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private heightText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Rectangle;
  private restartBtnLabel!: Phaser.GameObjects.Text;
  private restartHintText!: Phaser.GameObjects.Text;
  private continueBtn!: Phaser.GameObjects.Rectangle;
  private continueBtnLabel!: Phaser.GameObjects.Text;

  private isVisible = false;
  private restartPressed = false;
  // Reserved for the future second tower. Never set true while the continue
  // button stays disabled, but the consume API is in place for later.
  private continuePressed = false;

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
    this.continuePressed = false;

    this.heightText.setText(`Height: ${snapshot.bestHeightMeters} m`);
    this.scoreText.setText(`Score: ${snapshot.score}`);

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

  // Future-tower hook. Always false this step (continue button is disabled).
  consumeContinuePressed(): boolean {
    const v = this.continuePressed;
    this.continuePressed = false;
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
    const depth = UI_CONFIG.towerCompleteDepth;

    this.overlay = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0x001a2e)
      .setScrollFactor(0)
      .setAlpha(UI_CONFIG.towerCompleteBgAlpha)
      .setDepth(depth);

    this.titleText = this.scene.add
      .text(W / 2, H * 0.24, "ICE TOWER\nCOMPLETE", {
        fontSize: "34px", fontFamily: FONT, color: UI_CONFIG.towerCompleteTitleColor,
        align: "center", stroke: "#000000", strokeThickness: 5,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.heightText = this.scene.add
      .text(W / 2, H * 0.42, "Height: 0 m", {
        fontSize: "20px", fontFamily: FONT, color: UI_CONFIG.towerCompleteAccentColor,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.scoreText = this.scene.add
      .text(W / 2, H * 0.50, "Score: 0", {
        fontSize: "20px", fontFamily: FONT, color: "#ffdd44",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    this.restartBtn = this.scene.add
      .rectangle(W / 2, H * 0.64, 200, 50, 0x224422)
      .setScrollFactor(0)
      .setAlpha(0.9)
      .setDepth(depth + 1)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => { this.restartPressed = true; })
      .on("pointerover", () => { this.restartBtn.setFillStyle(0x448844); })
      .on("pointerout",  () => { this.restartBtn.setFillStyle(0x224422); });

    this.restartBtnLabel = this.scene.add
      .text(W / 2, H * 0.64, "RESTART", {
        fontSize: "18px", fontFamily: FONT, color: "#aaffaa",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    this.restartHintText = this.scene.add
      .text(W / 2, H * 0.72, "or press  R", {
        fontSize: "13px", fontFamily: FONT, color: "#9999bb",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);

    // Disabled placeholder — second tower not implemented this step.
    this.continueBtn = this.scene.add
      .rectangle(W / 2, H * 0.83, 200, 46, 0x1a2233)
      .setScrollFactor(0)
      .setAlpha(0.8)
      .setDepth(depth + 1);

    this.continueBtnLabel = this.scene.add
      .text(W / 2, H * 0.83, "Next Tower: Coming Soon", {
        fontSize: "13px", fontFamily: FONT, color: UI_CONFIG.continueDisabledColor,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depth + 2);

    for (const obj of this.allObjects()) {
      obj.setVisible(false);
    }
  }

  private updateLayout(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    this.overlay.setPosition(W / 2, H / 2).setSize(W, H);
    this.titleText.setPosition(W / 2, H * 0.24);
    this.heightText.setPosition(W / 2, H * 0.42);
    this.scoreText.setPosition(W / 2, H * 0.50);
    this.restartBtn.setPosition(W / 2, H * 0.64);
    this.restartBtnLabel.setPosition(W / 2, H * 0.64);
    this.restartHintText.setPosition(W / 2, H * 0.72);
    this.continueBtn.setPosition(W / 2, H * 0.83);
    this.continueBtnLabel.setPosition(W / 2, H * 0.83);
  }

  private allObjects(): (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] {
    return [
      this.overlay, this.titleText, this.heightText, this.scoreText,
      this.restartBtn, this.restartBtnLabel, this.restartHintText,
      this.continueBtn, this.continueBtnLabel,
    ];
  }
}
