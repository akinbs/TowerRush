import Phaser from "phaser";
import { ResultOverlay } from "./ResultOverlay";
import { UIPanel } from "../ui/UIPanel";
import { UIButton } from "../ui/UIButton";
import { UIChip } from "../ui/UIChip";
import { UI_COLORS, UI_FONT, UI_SPACING, toCss } from "../config/uiTokens";
import { UI_CONFIG } from "../config/uiConfig";

export interface GameOverCallbacks {
  onRestart: () => void;
  onMainMenu?: () => void;
}

export interface GameOverShowParams {
  score: number;
  // Height reached this run (metres).
  heightMeters: number;
  // Best height across runs (metres) — for the BEST chip.
  bestHeightMeters: number;
  isNewBest?: boolean;
  deathReason?: string;
}

const PANEL_W = 320;
const PANEL_H = 392;
const BTN_W = 248;
const BTN_H = 56;

// "You lost, try again" result card. Coral/danger accent, deep-navy glass panel.
// Restart (primary) + Main Menu (secondary). Built on the shared ResultOverlay
// scaffolding so it matches the pause modal's material and motion.
export class GameOverController extends ResultOverlay {
  private readonly callbacks: GameOverCallbacks;
  private readonly reasonText: Phaser.GameObjects.Text;
  private readonly newBestBadge: UIChip;
  private readonly scoreChip: UIChip;
  private readonly heightChip: UIChip;
  private readonly bestChip: UIChip;

  constructor(scene: Phaser.Scene, callbacks: GameOverCallbacks) {
    super(scene, UI_CONFIG.gameOverDepth, PANEL_W, PANEL_H);
    this.callbacks = callbacks;
    const top = -PANEL_H / 2;

    const panel = new UIPanel(scene, 0, 0, { width: PANEL_W, height: PANEL_H });

    // Coral title — no glow (danger never glows; glow is reserved for success).
    const title = scene.add
      .text(0, top + 40, "GAME OVER", {
        fontFamily: UI_FONT.display, fontSize: "34px", fontStyle: "bold",
        color: toCss(UI_COLORS.danger),
        stroke: toCss(UI_COLORS.backgroundPrimary), strokeThickness: 5,
      })
      .setOrigin(0.5);
    const accent = scene.add.rectangle(0, top + 66, 120, 3, UI_COLORS.danger, 0.9);

    this.reasonText = scene.add
      .text(0, top + 88, "", {
        fontFamily: UI_FONT.body, fontSize: "13px", color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0.5);

    this.newBestBadge = new UIChip(scene, 0, top + 116, "", "NEW BEST", {
      width: 124, height: 26, accent: UI_COLORS.gold,
    });
    this.newBestBadge.setVisible(false);

    this.scoreChip = new UIChip(scene, -64, top + 156, "SCORE", "0", {
      width: 124, height: 30, accent: UI_COLORS.gold,
    });
    this.heightChip = new UIChip(scene, 64, top + 156, "HGT", "0m", {
      width: 124, height: 30, accent: UI_COLORS.ice,
    });
    this.bestChip = new UIChip(scene, 0, top + 192, "BEST", "0m", {
      width: 150, height: 30, accent: UI_COLORS.aurora,
    });

    const restartBtn = new UIButton(scene, 0, top + 246, "RESTART", () => this.callbacks.onRestart(), {
      variant: "primary", width: BTN_W, height: BTN_H, fontSize: 20,
    });
    const menuBtn = this.buildMenuButton(scene, top + 246 + BTN_H + UI_SPACING.sm);

    const hint = scene.add
      .text(0, top + 366, "or press  R", {
        fontFamily: UI_FONT.body, fontSize: "12px", color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0.5);

    this.addToCard([
      panel, title, accent, this.reasonText, this.newBestBadge,
      this.scoreChip, this.heightChip, this.bestChip, restartBtn, menuBtn, hint,
    ]);
    this.initLayout();
  }

  show(params: GameOverShowParams): void {
    this.scoreChip.setValue(String(params.score));
    this.heightChip.setValue(`${params.heightMeters}m`);
    this.bestChip.setValue(`${params.bestHeightMeters}m`);
    this.reasonText.setText(params.deathReason ?? "You fell from the tower");

    const newBest = params.isNewBest ?? false;
    this.newBestBadge.setVisible(newBest);

    this.present();
    if (newBest) this.popIn(this.newBestBadge, 240);
  }

  // ── Private ────────────────────────────────────────────────────────────

  private buildMenuButton(scene: Phaser.Scene, y: number): UIButton {
    if (this.callbacks.onMainMenu) {
      return new UIButton(scene, 0, y, "MAIN MENU", () => this.callbacks.onMainMenu?.(), {
        variant: "secondary", width: BTN_W, height: BTN_H, fontSize: 18,
      });
    }
    const btn = new UIButton(scene, 0, y, "MENU SOON", () => undefined, {
      variant: "secondary", width: BTN_W, height: BTN_H, fontSize: 18,
    });
    btn.setEnabledState(false);
    return btn;
  }
}
