import Phaser from "phaser";
import { UIChip } from "../ui/UIChip";
import { UIIconButton } from "../ui/UIIconButton";
import type { HazardSide } from "../types/gameTypes";
import { UI_COLORS, UI_DEPTHS, UI_SPACING } from "../config/uiTokens";

export interface HudCallbacks {
  onPausePressed: () => void;
}

export interface HudUpdateParams {
  score: number;
  heightMeters: number;
  bestHeightMeters: number;
  phaseLabel: string;
  isPaused: boolean;
  isSnowActive?: boolean;
}

const CHIP_H = 30;
const STATUS_PULSE_MS = 700;
const HAZARD_FLASH_MS = 450;

// In-game HUD, rebuilt on the UI token/component system. Two compact rows of
// chips + a centered status badge + a pause button, all scroll-independent and
// above the snow layer. Reads only — never mutates game state.
export class HudController {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: HudCallbacks;

  private readonly scoreChip: UIChip;
  private readonly heightChip: UIChip;
  private readonly bestChip: UIChip;
  private readonly statusChip: UIChip;
  private readonly hazardChip: UIChip;
  private readonly pauseButton: UIIconButton;

  private prevScore = 0;
  private prevBestHeight = 0;
  private statusPulse?: Phaser.Tweens.Tween;

  private readonly resizeHandler: () => void;

  constructor(scene: Phaser.Scene, callbacks: HudCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    this.scoreChip = new UIChip(scene, 0, 0, "SCORE", "0", { width: 120, height: CHIP_H, accent: UI_COLORS.gold });
    this.heightChip = new UIChip(scene, 0, 0, "HGT", "0m", { width: 104, height: CHIP_H, accent: UI_COLORS.ice });
    this.bestChip = new UIChip(scene, 0, 0, "BEST", "0m", { width: 112, height: CHIP_H, accent: UI_COLORS.textPrimary });
    this.statusChip = new UIChip(scene, 0, 0, "", "WARMUP", { width: 130, height: CHIP_H, accent: UI_COLORS.gold });
    this.hazardChip = new UIChip(scene, 0, 0, "", "WARN", { width: 96, height: CHIP_H, accent: UI_COLORS.danger });
    this.hazardChip.setVisible(false).setAlpha(0);

    this.pauseButton = new UIIconButton(scene, 0, 0, "pause", () => this.callbacks.onPausePressed(), { size: 48 });

    for (const obj of this.allObjects()) obj.setScrollFactor(0).setDepth(UI_DEPTHS.hud);

    this.layout(scene.scale.width, scene.scale.height);

    this.resizeHandler = () => this.layout(this.scene.scale.width, this.scene.scale.height);
    scene.scale.on("resize", this.resizeHandler);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  update(params: HudUpdateParams): void {
    // Score: bump only on increase.
    this.scoreChip.setValue(String(params.score), params.score > this.prevScore);
    this.prevScore = params.score;

    this.heightChip.setValue(`${params.heightMeters}m`);

    this.bestChip.setValue(
      `${params.bestHeightMeters}m`,
      params.bestHeightMeters > this.prevBestHeight,
    );
    this.prevBestHeight = params.bestHeightMeters;

    this.updateStatus(params);
    this.pauseButton.setIcon(params.isPaused ? "play" : "pause");
  }

  // Briefly flashes a side-projectile warning chip (top-right, row 2).
  showHazardWarning(side?: HazardSide): void {
    const text = side === "left" ? "WARN L" : side === "right" ? "WARN R" : "WARN";
    this.hazardChip.setValue(text);
    this.scene.tweens.killTweensOf(this.hazardChip);
    this.hazardChip.setVisible(true).setAlpha(1);
    this.scene.tweens.add({
      targets: this.hazardChip,
      alpha: 0,
      duration: HAZARD_FLASH_MS,
      ease: "Linear",
      onComplete: () => this.hazardChip.setVisible(false),
    });
  }

  setVisible(visible: boolean): void {
    for (const obj of this.persistentObjects()) obj.setVisible(visible);
    this.pauseButton.setEnabledState(visible);
    if (!visible) {
      this.hazardChip.setVisible(false);
      this.scene.tweens.killTweensOf(this.hazardChip);
    }
  }

  layout(w: number, _h: number): void {
    const safe = UI_SPACING.lg;
    const r1 = safe + 22;
    const r2 = r1 + CHIP_H + UI_SPACING.sm;
    const pauseR = 24;

    this.pauseButton.setPosition(w - safe - pauseR, r1);
    this.scoreChip.setPosition(safe + 60, r1);
    this.heightChip.setPosition(w - safe - pauseR * 2 - UI_SPACING.sm - 52, r1);

    this.statusChip.setPosition(w / 2, r2);
    this.bestChip.setPosition(safe + 56, r2);
    this.hazardChip.setPosition(w - safe - 48, r2);
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    this.statusPulse?.stop();
    this.scene.tweens.killTweensOf(this.hazardChip);
    for (const obj of this.allObjects()) obj.destroy();
  }

  // ── Private ────────────────────────────────────────────────────────────

  // Status priority: paused > snow > phase.
  private updateStatus(params: HudUpdateParams): void {
    let text: string;
    let color: number;
    let pulse: boolean;

    if (params.isPaused) {
      text = "PAUSED";
      color = UI_COLORS.gold;
      pulse = false;
    } else if (params.isSnowActive) {
      text = "SNOW TIME";
      color = UI_COLORS.ice;
      pulse = true;
    } else {
      text = params.phaseLabel.toUpperCase();
      color = this.phaseColor(params.phaseLabel);
      pulse = false;
    }

    this.statusChip.setValue(text).setAccentColor(color);
    this.applyStatusPulse(pulse);
  }

  private phaseColor(label: string): number {
    const l = label.toLowerCase();
    if (l.includes("warmup")) return UI_COLORS.gold;
    if (l.includes("summit")) return UI_COLORS.aurora;
    return UI_COLORS.ice; // mixed ice / default
  }

  private applyStatusPulse(on: boolean): void {
    if (on && !this.statusPulse) {
      this.statusPulse = this.scene.tweens.add({
        targets: this.statusChip,
        alpha: { from: 1, to: 0.55 },
        duration: STATUS_PULSE_MS,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else if (!on && this.statusPulse) {
      this.statusPulse.stop();
      this.statusPulse = undefined;
      this.statusChip.setAlpha(1);
    }
  }

  private persistentObjects(): Array<UIChip | UIIconButton> {
    return [this.scoreChip, this.heightChip, this.bestChip, this.statusChip, this.pauseButton];
  }

  private allObjects(): Array<UIChip | UIIconButton> {
    return [...this.persistentObjects(), this.hazardChip];
  }
}
