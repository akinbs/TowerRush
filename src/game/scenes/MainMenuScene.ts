import Phaser from "phaser";
import {
  ANIM_DIR_RIGHT,
  ANIM_PLAYER_IDLE,
  SCENE_GAME,
  SCENE_MAIN_MENU,
  TEX_PLAYER,
} from "../utils/constants";
import {
  UI_ALPHA,
  UI_COLORS,
  UI_DEPTHS,
  UI_FONT,
  UI_MOTION,
  UI_SPACING,
  UI_STROKE,
  toCss,
} from "../config/uiTokens";
import { UIButton } from "../ui/UIButton";
import { UIChip } from "../ui/UIChip";
import { UIIconButton } from "../ui/UIIconButton";
import { UIPanel } from "../ui/UIPanel";
import { AudioStateController } from "../systems/AudioStateController";
import { SaveController } from "../integrations/youtube/SaveController";
import { YouTubePlayablesBridge } from "../integrations/youtube/YouTubePlayablesBridge";

// Character-preview scales, tuned for the 48×64 character frame (smaller than
// the old 32×48 placeholder's, so the on-screen size stays roughly the same).
const PREVIEW_SCALE = 1.2;
const PREVIEW_ENTER_SCALE = 1.05;

// Main menu: branded entry between Preload and Game. Primitive-only UI (no new
// assets). Shows best score/height, sound toggle, a settings placeholder, and a
// character preview, then starts a clean GameScene on START.
export class MainMenuScene extends Phaser.Scene {
  // Background
  private bgMist!: Phaser.GameObjects.Rectangle;
  private bgAurora1!: Phaser.GameObjects.Arc;
  private bgAurora2!: Phaser.GameObjects.Arc;

  // Content
  private logo!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private previewPlatform!: Phaser.GameObjects.Rectangle;
  private previewChar!: Phaser.GameObjects.Sprite;
  private bestChip!: UIChip;
  private heightChip!: UIChip;
  private startButton!: UIButton;
  private soundButton!: UIIconButton;
  private settingsButton!: UIIconButton;
  private hintText!: Phaser.GameObjects.Text;
  private versionText!: Phaser.GameObjects.Text;

  // Settings modal
  private settingsModal: Phaser.GameObjects.Container | null = null;
  private settingsSoundButton: UIIconButton | null = null;

  private starting = false;
  private shutdownFlag = false;

  constructor() {
    super({ key: SCENE_MAIN_MENU });
  }

  create(): void {
    this.starting = false;
    this.shutdownFlag = false;

    this.cameras.main.setBackgroundColor(UI_COLORS.backgroundPrimary);
    this.buildBackground();
    this.buildContent();
    this.layout(this.scale.width, this.scale.height);
    this.refreshSoundVisuals();
    this.animateIn();

    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.registerInput();

    // The menu is interactive at this point → the safe gameReady() signal.
    // The bridge is idempotent, so GameScene's later call is a harmless no-op.
    YouTubePlayablesBridge.getInstance().markGameReady();
    void this.loadBest();
  }

  // ── Build ──────────────────────────────────────────────────────────────

  private buildBackground(): void {
    this.bgMist = this.add
      .rectangle(0, 0, 10, 10, UI_COLORS.backgroundSecondary, 0.55)
      .setDepth(UI_DEPTHS.background);
    this.bgAurora1 = this.add
      .circle(0, 0, 10, UI_COLORS.aurora, 0.1)
      .setDepth(UI_DEPTHS.background);
    this.bgAurora2 = this.add
      .circle(0, 0, 10, UI_COLORS.ice, 0.08)
      .setDepth(UI_DEPTHS.background);
  }

  private buildContent(): void {
    this.logo = this.add
      .text(0, 0, "ICY TOWER", {
        fontFamily: UI_FONT.display,
        fontSize: "44px",
        fontStyle: "bold",
        color: toCss(UI_COLORS.textPrimary),
        stroke: toCss(UI_COLORS.backgroundPrimary),
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.logo.setShadow(0, 3, toCss(UI_COLORS.ice), 10, false, true);

    this.subtitle = this.add
      .text(0, 0, "ICE TOWER", {
        fontFamily: UI_FONT.body,
        fontSize: "14px",
        fontStyle: "bold",
        color: toCss(UI_COLORS.ice),
      })
      .setOrigin(0.5);

    this.previewPlatform = this.add
      .rectangle(0, 0, 96, 14, UI_COLORS.panelSoft, 0.9)
      .setStrokeStyle(UI_STROKE.base, UI_COLORS.border, 0.5);
    // Origin Y 0.95 ≈ the feet row (source y≈61/64) so the character stands on
    // the preview platform rather than floating above it.
    this.previewChar = this.add
      .sprite(0, 0, TEX_PLAYER, 0)
      .setOrigin(0.5, 0.95)
      .setScale(PREVIEW_SCALE);
    this.previewChar.play(ANIM_PLAYER_IDLE + ANIM_DIR_RIGHT);

    this.bestChip = new UIChip(this, 0, 0, "BEST", "0", { accent: UI_COLORS.gold });
    this.heightChip = new UIChip(this, 0, 0, "HEIGHT", "0m", { accent: UI_COLORS.ice });

    this.startButton = new UIButton(this, 0, 0, "START", () => this.startGame(), {
      variant: "primary",
      width: 220,
      height: 60,
      fontSize: 22,
    });

    this.soundButton = new UIIconButton(this, 0, 0, "sound-on", () => this.toggleSound(), { size: 52 });
    this.settingsButton = new UIIconButton(this, 0, 0, "gear", () => this.openSettings(), { size: 52 });

    this.hintText = this.add
      .text(0, 0, "Tap START to climb", {
        fontFamily: UI_FONT.body,
        fontSize: "13px",
        color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0.5);

    this.versionText = this.add
      .text(0, 0, "Ice Tower · v0.1", {
        fontFamily: UI_FONT.body,
        fontSize: "11px",
        color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(0.5);

    for (const obj of this.menuContent()) {
      obj.setDepth(UI_DEPTHS.menu);
    }
  }

  private menuContent(): Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth> {
    return [
      this.logo, this.subtitle, this.previewPlatform, this.previewChar,
      this.bestChip, this.heightChip, this.startButton,
      this.soundButton, this.settingsButton, this.hintText, this.versionText,
    ];
  }

  // ── Layout (responsive) ──────────────────────────────────────────────────

  private layout(w: number, h: number): void {
    const cx = w / 2;
    const safe = UI_SPACING.lg;
    const big = Math.max(w, h);

    this.bgMist.setPosition(cx, h - h * 0.12).setSize(w, h * 0.24);
    this.bgAurora1.setPosition(w * 0.28, h * 0.22).setRadius(big * 0.42);
    this.bgAurora2.setPosition(w * 0.78, h * 0.12).setRadius(big * 0.34);

    const iconR = 26;
    this.settingsButton.setPosition(w - safe - iconR, safe + iconR);
    this.soundButton.setPosition(w - safe - iconR - 64, safe + iconR);

    this.logo.setPosition(cx, h * 0.16);
    this.subtitle.setPosition(cx, h * 0.16 + 34);

    const platY = h * 0.45;
    this.previewPlatform.setPosition(cx, platY);
    this.previewChar.setPosition(cx, platY - this.previewPlatform.height / 2);

    const chipY = h * 0.6;
    this.bestChip.setPosition(cx - 62, chipY);
    this.heightChip.setPosition(cx + 62, chipY);

    this.startButton.setPosition(cx, h * 0.75);
    this.hintText.setPosition(cx, h * 0.75 + 52);
    this.versionText.setPosition(cx, h - safe);

    if (this.settingsModal) this.settingsModal.setPosition(cx, h / 2);
  }

  private handleResize(size: Phaser.Structs.Size): void {
    this.layout(size.width, size.height);
  }

  // ── Motion ───────────────────────────────────────────────────────────────

  private animateIn(): void {
    // Aurora drift (subtle, infinite).
    this.tweens.add({
      targets: [this.bgAurora1, this.bgAurora2],
      alpha: { from: 0.06, to: 0.14 },
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Logo + subtitle rise/fade.
    this.riseIn(this.logo, 0);
    this.riseIn(this.subtitle, 60);

    // Character preview pop + idle bob.
    this.previewChar.setAlpha(0).setScale(PREVIEW_ENTER_SCALE);
    this.tweens.add({
      targets: this.previewChar,
      alpha: 1,
      scale: PREVIEW_SCALE,
      duration: UI_MOTION.cardEnterMs,
      delay: 120,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: this.previewChar,
      y: "-=6",
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 400,
    });

    // Chips stagger.
    this.fadeIn(this.bestChip, 180);
    this.fadeIn(this.heightChip, 260);

    // Start button pop.
    this.startButton.setAlpha(0).setScale(0.9);
    this.tweens.add({
      targets: this.startButton,
      alpha: 1,
      scale: 1,
      duration: 300,
      delay: 320,
      ease: "Back.easeOut",
    });

    // Top bar + footer fade.
    this.fadeIn(this.soundButton, 200);
    this.fadeIn(this.settingsButton, 240);
    this.fadeIn(this.versionText, 360);

    // Hint pulse.
    this.hintText.setAlpha(0.4);
    this.tweens.add({
      targets: this.hintText,
      alpha: 1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 400,
    });
  }

  private riseIn(obj: Phaser.GameObjects.Text, delay: number): void {
    const targetY = obj.y;
    obj.setAlpha(0);
    obj.y = targetY + 18;
    this.tweens.add({
      targets: obj,
      y: targetY,
      alpha: 1,
      duration: UI_MOTION.modalOpenMs,
      delay,
      ease: "Cubic.easeOut",
    });
  }

  private fadeIn(obj: Phaser.GameObjects.GameObject & { setAlpha(v: number): unknown }, delay: number): void {
    obj.setAlpha(0);
    this.tweens.add({ targets: obj, alpha: 1, duration: UI_MOTION.modalOpenMs, delay, ease: "Cubic.easeOut" });
  }

  // ── Input ──────────────────────────────────────────────────────────────

  private registerInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on("keydown-ENTER", this.startGame, this);
    kb.on("keydown-SPACE", this.startGame, this);
    kb.on("keydown-ESC", this.closeSettings, this);
  }

  private startGame(): void {
    if (this.starting || this.settingsModal) return;
    this.starting = true;
    this.scene.start(SCENE_GAME);
  }

  // ── Sound ──────────────────────────────────────────────────────────────

  private toggleSound(): void {
    const audio = AudioStateController.getInstance();
    if (!audio.isHostEnabled()) return; // host forbids audio → can't un-mute
    audio.setUserMuted(!audio.isUserMuted());
    this.refreshSoundVisuals();
  }

  private refreshSoundVisuals(): void {
    const audio = AudioStateController.getInstance();
    const on = audio.isAudioEnabled();
    const icon = on ? "sound-on" : "sound-off";
    const hostOk = audio.isHostEnabled();

    this.soundButton.setIcon(icon).setEnabledState(hostOk);
    this.settingsSoundButton?.setIcon(icon).setEnabledState(hostOk);
  }

  // ── Settings placeholder ────────────────────────────────────────────────

  private openSettings(): void {
    if (this.settingsModal) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const audio = AudioStateController.getInstance();

    const modal = this.add.container(w / 2, h / 2).setDepth(UI_DEPTHS.overlay);

    const scrim = this.add
      .rectangle(0, 0, w * 2, h * 2, UI_COLORS.backgroundPrimary, UI_ALPHA.overlay)
      .setInteractive();

    const panel = new UIPanel(this, 0, 0, { width: 300, height: 230, title: "SETTINGS" });

    const soundLabel = this.add
      .text(-110, -12, "Sound", {
        fontFamily: UI_FONT.body, fontSize: "16px", color: toCss(UI_COLORS.textPrimary),
      })
      .setOrigin(0, 0.5);
    this.settingsSoundButton = new UIIconButton(
      this, 110, -12, audio.isAudioEnabled() ? "sound-on" : "sound-off",
      () => this.toggleSound(), { size: 48 },
    );

    const rmLabel = this.add
      .text(-110, 40, "Reduced Motion", {
        fontFamily: UI_FONT.body, fontSize: "16px", color: toCss(UI_COLORS.textPrimary),
      })
      .setOrigin(0, 0.5);
    const rmHint = this.add
      .text(110, 40, "Coming Soon", {
        fontFamily: UI_FONT.body, fontSize: "13px", color: toCss(UI_COLORS.textSecondary),
      })
      .setOrigin(1, 0.5);

    const closeBtn = new UIButton(this, 0, 90, "CLOSE", () => this.closeSettings(), {
      variant: "secondary", width: 160,
    });

    modal.add([scrim, panel, soundLabel, this.settingsSoundButton, rmLabel, rmHint, closeBtn]);
    this.settingsModal = modal;
    this.refreshSoundVisuals();

    modal.setAlpha(0);
    panel.setScale(0.96);
    this.tweens.add({ targets: modal, alpha: 1, duration: UI_MOTION.modalOpenMs, ease: "Cubic.easeOut" });
    this.tweens.add({ targets: panel, scale: 1, duration: UI_MOTION.modalOpenMs, ease: "Back.easeOut" });
  }

  private closeSettings(): void {
    if (!this.settingsModal) return;
    const modal = this.settingsModal;
    this.settingsModal = null;
    this.settingsSoundButton = null;
    this.tweens.add({
      targets: modal,
      alpha: 0,
      duration: UI_MOTION.modalOpenMs / 2,
      ease: "Cubic.easeIn",
      onComplete: () => modal.destroy(),
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────

  private async loadBest(): Promise<void> {
    const save = SaveController.getInstance();
    await save.initialize();
    if (this.shutdownFlag) return;
    const data = save.getSaveData();
    this.bestChip.setValue(String(data.bestScore), true);
    this.heightChip.setValue(`${data.bestHeightMeters}m`, true);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  private onShutdown(): void {
    this.shutdownFlag = true;
    this.scale.off("resize", this.handleResize, this);
    const kb = this.input.keyboard;
    kb?.off("keydown-ENTER", this.startGame, this);
    kb?.off("keydown-SPACE", this.startGame, this);
    kb?.off("keydown-ESC", this.closeSettings, this);
    this.tweens.killAll();
    // Scene shutdown destroys child GameObjects; null the modal handle so a
    // late tween callback can't touch a torn-down container.
    this.settingsModal = null;
    this.settingsSoundButton = null;
  }
}
