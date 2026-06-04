import Phaser from "phaser";
import { UIPanel } from "../ui/UIPanel";
import { UIButton } from "../ui/UIButton";
import { UIChip } from "../ui/UIChip";
import { UIIconButton } from "../ui/UIIconButton";
import {
  UI_ALPHA,
  UI_COLORS,
  UI_DEPTHS,
  UI_FONT,
  UI_MOTION,
  UI_SPACING,
  toCss,
} from "../config/uiTokens";

export interface PauseOverlayCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu?: () => void;
  onToggleSound: () => void;
}

export interface PauseOverlayShowParams {
  score?: number;
  heightMeters?: number;
  bestHeightMeters?: number;
  soundEnabled?: boolean;
}

// Panel geometry (logical units @ 400×700). Fixed at build time; the whole card
// is uniformly down-scaled on small screens rather than re-flowed.
const PANEL_W = 320;
const PANEL_H = 336;
const BTN_W = 248;
const BTN_H = 56;
// Oversized scrim so a single fixed rectangle always covers the viewport (and its
// input hit-area never needs rebuilding on resize).
const SCRIM_SIZE = 4096;

// User-initiated pause modal. Owns only its own GameObjects + one resize listener.
// It never reads or mutates game/pause state — GameScene drives show()/hide() and
// routes the button presses back through the callbacks. Used for USER pause only;
// platform (host) pause is handled separately and never opens this overlay.
export class PauseOverlayController {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: PauseOverlayCallbacks;

  private readonly root: Phaser.GameObjects.Container;
  private readonly card: Phaser.GameObjects.Container;
  private readonly scrim: Phaser.GameObjects.Rectangle;
  private readonly scoreChip: UIChip;
  private readonly heightChip: UIChip;
  private readonly bestChip: UIChip;
  private readonly soundButton: UIIconButton;

  private readonly resizeHandler: () => void;

  // Responsive scale of the card (1 on phones ≥ panel size, < 1 when clamped).
  private cardScale = 1;
  private shown = false;

  constructor(scene: Phaser.Scene, callbacks: PauseOverlayCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(UI_DEPTHS.pause);
    this.card = scene.add.container(0, 0);

    // Full-bleed dim. Interactive so taps behind the modal (incl. the HUD pause
    // button) are swallowed; the scrim itself is inert (no resume-on-tap).
    this.scrim = scene.add
      .rectangle(0, 0, SCRIM_SIZE, SCRIM_SIZE, UI_COLORS.backgroundPrimary, UI_ALPHA.overlay)
      .setScrollFactor(0)
      .setInteractive();

    const panel = new UIPanel(scene, 0, 0, { width: PANEL_W, height: PANEL_H, title: "PAUSED" });
    const top = -PANEL_H / 2;

    const subtitle = scene.add
      .text(0, top + 50, "Ice Tower run paused", {
        fontFamily: UI_FONT.body,
        fontSize: "13px",
        color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0.5);

    this.scoreChip = new UIChip(scene, -64, top + 88, "SCORE", "0", {
      width: 124, height: 30, accent: UI_COLORS.gold,
    });
    this.heightChip = new UIChip(scene, 64, top + 88, "HGT", "0m", {
      width: 124, height: 30, accent: UI_COLORS.ice,
    });
    this.bestChip = new UIChip(scene, 0, top + 124, "BEST", "0m", {
      width: 150, height: 30, accent: UI_COLORS.textPrimary,
    });

    const resumeBtn = new UIButton(scene, 0, top + 176, "RESUME", () => this.callbacks.onResume(), {
      variant: "primary", width: BTN_W, height: BTN_H, fontSize: 20,
    });
    const restartBtn = new UIButton(scene, 0, top + 176 + BTN_H + UI_SPACING.sm, "RESTART", () => this.callbacks.onRestart(), {
      variant: "secondary", width: BTN_W, height: BTN_H, fontSize: 18,
    });
    const menuBtn = this.buildMenuButton(scene, top + 176 + (BTN_H + UI_SPACING.sm) * 2);

    // Sound toggle lives in the panel's top-right corner.
    this.soundButton = new UIIconButton(
      scene, PANEL_W / 2 - 28, top + 28,
      this.iconFor(true), () => this.callbacks.onToggleSound(), { size: 48 },
    );

    this.card.add([
      panel, subtitle, this.scoreChip, this.heightChip, this.bestChip,
      resumeBtn, restartBtn, menuBtn, this.soundButton,
    ]);
    this.root.add([this.scrim, this.card]);
    this.root.setVisible(false);

    this.layout(scene.scale.width, scene.scale.height);

    this.resizeHandler = () => this.layout(this.scene.scale.width, this.scene.scale.height);
    scene.scale.on("resize", this.resizeHandler);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  show(params: PauseOverlayShowParams = {}): void {
    this.scoreChip.setValue(String(params.score ?? 0));
    this.heightChip.setValue(`${params.heightMeters ?? 0}m`);
    this.bestChip.setValue(`${params.bestHeightMeters ?? 0}m`);
    if (params.soundEnabled !== undefined) this.updateSoundState(params.soundEnabled);

    this.shown = true;
    this.killTweens();
    this.root.setVisible(true);

    this.scrim.setAlpha(0);
    this.card.setAlpha(0).setScale(this.cardScale * 0.92);

    this.scene.tweens.add({
      targets: this.scrim, alpha: 1, duration: 140, ease: "Cubic.easeOut",
    });
    this.scene.tweens.add({
      targets: this.card, alpha: 1, scale: this.cardScale,
      duration: UI_MOTION.modalOpenMs, ease: "Back.easeOut",
    });
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.killTweens();

    this.scene.tweens.add({
      targets: this.scrim, alpha: 0, duration: 140, ease: "Cubic.easeIn",
    });
    this.scene.tweens.add({
      targets: this.card, alpha: 0, scale: this.cardScale * 0.96,
      duration: 150, ease: "Cubic.easeIn",
      onComplete: () => { if (!this.shown) this.root.setVisible(false); },
    });
  }

  // Snaps the overlay shut with no animation — used when an end-of-run state
  // (gameOver / towerComplete) takes over the screen.
  hideImmediate(): void {
    this.shown = false;
    this.killTweens();
    this.root.setVisible(false);
  }

  updateSoundState(enabled: boolean): void {
    this.soundButton.setIcon(this.iconFor(enabled));
  }

  isVisible(): boolean {
    return this.shown;
  }

  layout(w: number, h: number): void {
    const safe = UI_SPACING.lg;
    this.root.setPosition(w / 2, h / 2);
    // Uniform down-scale on screens too small for the fixed panel (portrait or
    // short-landscape). Never scale UP past 1 → keeps touch targets honest.
    this.cardScale = Math.min(1, (w - safe * 2) / PANEL_W, (h - safe * 2) / PANEL_H);
    // Reflect the new scale immediately when already open (no tween in flight on
    // a steady-state resize); show()/hide() own the scale while animating.
    if (this.shown) this.card.setScale(this.cardScale);
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    this.killTweens();
    this.root.destroy(); // destroys card + scrim + all primitives (children)
  }

  // ── Private ────────────────────────────────────────────────────────────

  private buildMenuButton(scene: Phaser.Scene, y: number): UIButton {
    if (this.callbacks.onMainMenu) {
      return new UIButton(scene, 0, y, "MAIN MENU", () => this.callbacks.onMainMenu?.(), {
        variant: "secondary", width: BTN_W, height: BTN_H, fontSize: 18,
      });
    }
    // No safe menu route wired → disabled placeholder.
    const btn = new UIButton(scene, 0, y, "MENU SOON", () => undefined, {
      variant: "secondary", width: BTN_W, height: BTN_H, fontSize: 18,
    });
    btn.setEnabledState(false);
    return btn;
  }

  private iconFor(enabled: boolean): "sound-on" | "sound-off" {
    return enabled ? "sound-on" : "sound-off";
  }

  private killTweens(): void {
    this.scene.tweens.killTweensOf(this.scrim);
    this.scene.tweens.killTweensOf(this.card);
  }
}
