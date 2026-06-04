import Phaser from "phaser";
import { ResultOverlay } from "./ResultOverlay";
import { UIPanel } from "../ui/UIPanel";
import { UIButton } from "../ui/UIButton";
import { UIChip } from "../ui/UIChip";
import { UI_COLORS, UI_FONT, UI_SPACING, toCss } from "../config/uiTokens";
import { UI_CONFIG } from "../config/uiConfig";

export interface TowerCompletionCallbacks {
  onRestart: () => void;
  onMainMenu?: () => void;
  // Reserved for the future second tower. The placeholder is non-interactive, so
  // this is never invoked this step.
  onContinue?: () => void;
}

export interface TowerCompletionShowParams {
  score: number;
  // Summit height reached this run (metres).
  heightMeters: number;
  // Best height across runs (metres) — for the BEST chip.
  bestHeightMeters: number;
  isNewBest?: boolean;
  towerName?: string;
}

const PANEL_W = 320;
const PANEL_H = 410;
const BTN_W = 248;
const BTN_H = 56;

// "You made it" summit result card. Gold/aurora success accent + soft glow on the
// title (glow is reserved for success energy). Restart (primary) + Main Menu
// (secondary) + a disabled "Next Tower" placeholder chip. The aurora ring pulse
// behind it is fired separately by FxController, so this only enters the card.
export class TowerCompletionController extends ResultOverlay {
  private readonly callbacks: TowerCompletionCallbacks;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly newBestBadge: UIChip;
  private readonly scoreChip: UIChip;
  private readonly heightChip: UIChip;
  private readonly bestChip: UIChip;

  constructor(scene: Phaser.Scene, callbacks: TowerCompletionCallbacks) {
    super(scene, UI_CONFIG.towerCompleteDepth, PANEL_W, PANEL_H);
    this.callbacks = callbacks;
    const top = -PANEL_H / 2;

    const panel = new UIPanel(scene, 0, 0, { width: PANEL_W, height: PANEL_H });

    const title = scene.add
      .text(0, top + 52, "ICE TOWER\nCOMPLETE", {
        fontFamily: UI_FONT.display, fontSize: "30px", fontStyle: "bold",
        align: "center", color: toCss(UI_COLORS.gold),
        stroke: toCss(UI_COLORS.backgroundPrimary), strokeThickness: 5,
      })
      .setOrigin(0.5);
    title.setShadow(0, 2, toCss(UI_COLORS.gold), 12, false, true); // soft success glow
    const accent = scene.add.rectangle(0, top + 88, 140, 3, UI_COLORS.aurora, 0.95);

    this.subtitleText = scene.add
      .text(0, top + 106, "Summit reached", {
        fontFamily: UI_FONT.body, fontSize: "13px", color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0.5);

    this.newBestBadge = new UIChip(scene, 0, top + 134, "", "NEW BEST", {
      width: 124, height: 26, accent: UI_COLORS.gold,
    });
    this.newBestBadge.setVisible(false);

    this.scoreChip = new UIChip(scene, -64, top + 172, "SCORE", "0", {
      width: 124, height: 30, accent: UI_COLORS.gold,
    });
    this.heightChip = new UIChip(scene, 64, top + 172, "HGT", "0m", {
      width: 124, height: 30, accent: UI_COLORS.ice,
    });
    this.bestChip = new UIChip(scene, 0, top + 206, "BEST", "0m", {
      width: 150, height: 30, accent: UI_COLORS.aurora,
    });

    const restartBtn = new UIButton(scene, 0, top + 260, "RESTART", () => this.callbacks.onRestart(), {
      variant: "primary", width: BTN_W, height: BTN_H, fontSize: 20,
    });
    const menuBtn = this.buildMenuButton(scene, top + 260 + BTN_H + UI_SPACING.sm);

    // Disabled placeholder — the second tower does not exist this step.
    const nextTowerChip = new UIChip(scene, 0, top + 376, "", "NEXT TOWER · SOON", {
      width: 220, height: 26, accent: UI_COLORS.textSecondary,
    });
    nextTowerChip.setAlpha(0.7);

    this.addToCard([
      panel, title, accent, this.subtitleText, this.newBestBadge,
      this.scoreChip, this.heightChip, this.bestChip, restartBtn, menuBtn, nextTowerChip,
    ]);
    this.initLayout();
  }

  show(params: TowerCompletionShowParams): void {
    this.scoreChip.setValue(String(params.score));
    this.heightChip.setValue(`${params.heightMeters}m`);
    this.bestChip.setValue(`${params.bestHeightMeters}m`);
    this.subtitleText.setText(params.towerName ? `${params.towerName} — summit reached` : "Summit reached");

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
