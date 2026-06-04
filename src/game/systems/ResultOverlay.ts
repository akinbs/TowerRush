import Phaser from "phaser";
import { UI_ALPHA, UI_COLORS, UI_SPACING } from "../config/uiTokens";

// Oversized scrim so one fixed rectangle always covers the viewport (its input
// hit-area then never needs rebuilding on resize).
const SCRIM_SIZE = 4096;

// Shared scaffolding for the end-of-run result overlays (Game Over / Tower
// Complete). Owns a full-bleed interactive scrim + a centred, uniformly
// down-scaled card container, the show/hide motion, responsive scaling, one
// resize listener and teardown. Subclasses fill `card` with their content in
// their constructor, call initLayout() once, then drive present()/hide().
//
// Reads/mutates no game state — GameScene drives show()/hide() and routes button
// presses back through the subclass callbacks.
export abstract class ResultOverlay {
  protected readonly scene: Phaser.Scene;
  protected readonly root: Phaser.GameObjects.Container;
  protected readonly card: Phaser.GameObjects.Container;
  private readonly scrim: Phaser.GameObjects.Rectangle;
  private readonly resizeHandler: () => void;
  private readonly panelW: number;
  private readonly panelH: number;

  protected cardScale = 1;
  private shown = false;

  constructor(scene: Phaser.Scene, depth: number, panelW: number, panelH: number) {
    this.scene = scene;
    this.panelW = panelW;
    this.panelH = panelH;

    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
    this.card = scene.add.container(0, 0);
    // Interactive so taps behind the card (incl. the HUD) are swallowed; the
    // scrim itself is inert.
    this.scrim = scene.add
      .rectangle(0, 0, SCRIM_SIZE, SCRIM_SIZE, UI_COLORS.backgroundPrimary, UI_ALPHA.overlay)
      .setScrollFactor(0)
      .setInteractive();

    this.root.add([this.scrim, this.card]);
    this.root.setVisible(false);

    this.resizeHandler = () => this.layout(this.scene.scale.width, this.scene.scale.height);
    scene.scale.on("resize", this.resizeHandler);
  }

  isVisible(): boolean {
    return this.shown;
  }

  layout(w: number, h: number): void {
    const safe = UI_SPACING.lg;
    this.root.setPosition(w / 2, h / 2);
    // Uniform down-scale on screens too small for the fixed card; never scale UP
    // past 1 so touch targets stay honest.
    this.cardScale = Math.min(1, (w - safe * 2) / this.panelW, (h - safe * 2) / this.panelH);
    if (this.shown) this.card.setScale(this.cardScale);
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.killTweens();
    this.scene.tweens.add({ targets: this.scrim, alpha: 0, duration: 140, ease: "Cubic.easeIn" });
    this.scene.tweens.add({
      targets: this.card, alpha: 0, scale: this.cardScale * 0.96,
      duration: 150, ease: "Cubic.easeIn",
      onComplete: () => { if (!this.shown) this.root.setVisible(false); },
    });
  }

  // Snaps shut with no animation — used if the scene tears down or another state
  // takes the screen.
  hideImmediate(): void {
    this.shown = false;
    this.killTweens();
    this.root.setVisible(false);
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    this.killTweens();
    this.root.destroy(); // destroys card + scrim + all primitives (children)
  }

  // ── Protected ──────────────────────────────────────────────────────────

  protected addToCard(objects: Phaser.GameObjects.GameObject[]): void {
    this.card.add(objects);
  }

  // Subclasses call once after all content is added to `card`.
  protected initLayout(): void {
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  // Plays the entrance. Call from the subclass's show() after content is set.
  protected present(): void {
    this.shown = true;
    this.killTweens();
    this.root.setVisible(true);

    this.scrim.setAlpha(0);
    this.card.setAlpha(0).setScale(this.cardScale * 0.9);

    this.scene.tweens.add({ targets: this.scrim, alpha: 1, duration: 160, ease: "Cubic.easeOut" });
    this.scene.tweens.add({
      targets: this.card, alpha: 1, scale: this.cardScale,
      duration: 270, ease: "Back.easeOut",
    });
  }

  // Small staggered pop for a child (e.g. the NEW BEST badge) after the card
  // lands. Scale is relative to the card, so the absolute 1 is correct.
  protected popIn(obj: Phaser.GameObjects.Container, delay: number): void {
    obj.setAlpha(0).setScale(0.6);
    this.scene.tweens.add({
      targets: obj, alpha: 1, scale: 1, duration: 260, delay, ease: "Back.easeOut",
    });
  }

  protected killTweens(): void {
    this.scene.tweens.killTweensOf(this.scrim);
    this.scene.tweens.killTweensOf(this.card);
  }
}
