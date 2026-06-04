import Phaser from "phaser";
import type { InputState } from "../types/gameTypes";
import { UI_COLORS, UI_CONTROL, UI_DEPTHS, UI_MOTION, UI_STROKE } from "../config/uiTokens";

type ButtonName = "left" | "right" | "jump" | "pause";
type IconKind = "left" | "right" | "up" | "pause";

// One ice-glass circular control. Input still uses scene-level pointer events +
// manual box hit-testing (cx/cy/hw/hh), so the visual press scale never affects
// touch accuracy.
interface ControlButton {
  root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc; // cyan press halo (alpha 0 idle)
  glass: Phaser.GameObjects.Arc; // translucent body + ring
  cx: number;
  cy: number;
  hw: number; // hit half-width
  hh: number; // hit half-height
  idleAlpha: number;
  pressed: boolean;
}

export class MobileControls {
  private readonly scene: Phaser.Scene;

  private leftBtn!: ControlButton;
  private rightBtn!: ControlButton;
  private jumpBtn!: ControlButton;
  private pauseBtn!: ControlButton;

  // Per-pointer tracking: pointer ID → which buttons it is currently holding.
  private readonly pointerButtons = new Map<number, ButtonName[]>();

  // One-shot flags — consumed on the next getState() call.
  private jumpJustPressed = false;
  private pauseJustPressed = false;

  // When false, the on-screen pause button is hidden AND excluded from hit
  // testing — pause is owned by the HUD button instead (UI Step 3).
  private pauseControlEnabled = true;
  // When false, controls are dimmed and ignore touches (pressed state reset).
  private enabled = true;

  private readonly resizeHandler: () => void;
  private readonly handlePointerDown: (ptr: Phaser.Input.Pointer) => void;
  private readonly handlePointerUp: (ptr: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Support up to 4 simultaneous touch points (movement + jump + incidental).
    scene.input.addPointer(3);

    this.createButtons();
    this.updateLayout();

    this.handlePointerDown = (ptr) => this.onPointerDown(ptr.id, ptr.x, ptr.y);
    this.handlePointerUp = (ptr) => this.onPointerUp(ptr.id);
    this.scene.input.on("pointerdown", this.handlePointerDown);
    this.scene.input.on("pointerup", this.handlePointerUp);
    // Cancel buttons if the pointer leaves the canvas.
    this.scene.input.on("pointerout", this.handlePointerUp);

    this.resizeHandler = () => this.updateLayout();
    scene.scale.on("resize", this.resizeHandler);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  // Returns the current mobile input state.
  // jumpPressed and pausePressed are consumed (reset) after this call.
  getState(): Pick<InputState, "left" | "right" | "jumpPressed" | "jumpHeld" | "pausePressed"> {
    const state = {
      left: this.isButtonDown("left"),
      right: this.isButtonDown("right"),
      jumpPressed: this.jumpJustPressed,
      jumpHeld: this.isButtonDown("jump"),
      pausePressed: this.pauseJustPressed,
    };
    this.jumpJustPressed = false;
    this.pauseJustPressed = false;
    return state;
  }

  setVisible(visible: boolean): void {
    this.leftBtn.root.setVisible(visible);
    this.rightBtn.root.setVisible(visible);
    this.jumpBtn.root.setVisible(visible);
    this.pauseBtn.root.setVisible(visible && this.pauseControlEnabled);
    // A hidden control must never leave a pointer "stuck" down.
    if (!visible) this.resetAllPressed();
  }

  // Dims controls and ignores touches without removing them (e.g. host pause).
  // Backward-compatible: no existing caller relies on it, so the default
  // enabled=true preserves current behaviour.
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.resetAllPressed();
    const alpha = enabled ? 1 : UI_CONTROL.disabledAlpha;
    this.leftBtn.root.setAlpha(alpha);
    this.rightBtn.root.setAlpha(alpha);
    this.jumpBtn.root.setAlpha(alpha);
  }

  // Disables/enables the on-screen pause button (visibility + hit testing).
  setPauseControlEnabled(enabled: boolean): void {
    this.pauseControlEnabled = enabled;
    this.pauseBtn.root.setVisible(enabled);
    if (!enabled) this.resetButton(this.pauseBtn);
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    this.scene.input.off("pointerdown", this.handlePointerDown);
    this.scene.input.off("pointerup", this.handlePointerUp);
    this.scene.input.off("pointerout", this.handlePointerUp);
    for (const btn of this.allButtons()) {
      this.scene.tweens.killTweensOf([btn.root, btn.glow]);
      btn.root.destroy(); // destroys glow + glass + icon children
    }
  }

  // ── Private — layout ───────────────────────────────────────────────────

  private createButtons(): void {
    this.leftBtn = this.createControlButton(UI_CONTROL.buttonRadius, UI_CONTROL.idleAlpha, "left");
    this.rightBtn = this.createControlButton(UI_CONTROL.buttonRadius, UI_CONTROL.idleAlpha, "right");
    this.jumpBtn = this.createControlButton(UI_CONTROL.jumpRadius, UI_CONTROL.jumpIdleAlpha, "up");
    this.pauseBtn = this.createControlButton(UI_CONTROL.pauseRadius, UI_CONTROL.idleAlpha, "pause");
  }

  updateLayout(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const { buttonRadius: r, jumpRadius: jr, pauseRadius: pr, sideMargin: sm, bottomMargin: bm, gap } = UI_CONTROL;

    const leftX = sm + r;
    const rightX = leftX + r * 2 + gap;
    const moveY = H - bm - r;

    this.placeButton(this.leftBtn, leftX, moveY);
    this.placeButton(this.rightBtn, rightX, moveY);
    this.placeButton(this.jumpBtn, W - sm - jr, H - bm - jr);
    this.placeButton(this.pauseBtn, W - sm - pr, sm + pr);
  }

  private createControlButton(radius: number, idleAlpha: number, icon: IconKind): ControlButton {
    const glow = this.scene.add.circle(0, 0, radius * 1.5, UI_COLORS.ice, 0);
    const glass = this.scene.add
      .circle(0, 0, radius, UI_COLORS.panelSoft, idleAlpha)
      .setStrokeStyle(UI_STROKE.bold, UI_COLORS.border, 0.5);
    const iconGfx = this.scene.add.graphics();
    this.drawIcon(iconGfx, icon, radius);

    const root = this.scene.add
      .container(0, 0, [glow, glass, iconGfx])
      .setScrollFactor(0)
      .setDepth(UI_DEPTHS.mobileControls);

    const hit = radius + UI_CONTROL.hitPad;
    return { root, glow, glass, cx: 0, cy: 0, hw: hit, hh: hit, idleAlpha, pressed: false };
  }

  private placeButton(btn: ControlButton, cx: number, cy: number): void {
    btn.cx = cx;
    btn.cy = cy;
    btn.root.setPosition(cx, cy);
  }

  // Generated glyphs — no fonts/emoji/assets, reliable across mobile webviews.
  private drawIcon(g: Phaser.GameObjects.Graphics, kind: IconKind, radius: number): void {
    const u = radius * 0.5;
    g.clear();
    g.fillStyle(UI_COLORS.textPrimary, 1);
    switch (kind) {
      case "left":
        g.fillTriangle(u * 0.55, -u * 0.8, u * 0.55, u * 0.8, -u * 0.7, 0);
        break;
      case "right":
        g.fillTriangle(-u * 0.55, -u * 0.8, -u * 0.55, u * 0.8, u * 0.7, 0);
        break;
      case "up":
        g.fillTriangle(-u * 0.8, u * 0.55, u * 0.8, u * 0.55, 0, -u * 0.7);
        break;
      case "pause":
        g.fillRect(-u * 0.5, -u * 0.6, u * 0.35, u * 1.2);
        g.fillRect(u * 0.15, -u * 0.6, u * 0.35, u * 1.2);
        break;
    }
  }

  // ── Private — input (unchanged behaviour) ──────────────────────────────

  private onPointerDown(ptrId: number, x: number, y: number): void {
    const wasJumpDown = this.isButtonDown("jump");
    const wasPauseDown = this.isButtonDown("pause");

    const hit = this.getHitButtons(x, y);
    if (hit.length === 0) return;

    this.pointerButtons.set(ptrId, hit);

    // Set one-shot flags for newly activated buttons.
    if (!wasJumpDown && this.isButtonDown("jump")) this.jumpJustPressed = true;
    if (!wasPauseDown && this.isButtonDown("pause")) this.pauseJustPressed = true;

    this.refreshButtonVisuals();
  }

  private onPointerUp(ptrId: number): void {
    if (!this.pointerButtons.has(ptrId)) return;
    this.pointerButtons.delete(ptrId);
    this.refreshButtonVisuals();
  }

  private getHitButtons(x: number, y: number): ButtonName[] {
    if (!this.enabled) return [];
    const result: ButtonName[] = [];
    const buttons: [ButtonName, ControlButton][] = [
      ["left", this.leftBtn],
      ["right", this.rightBtn],
      ["jump", this.jumpBtn],
    ];
    if (this.pauseControlEnabled) buttons.push(["pause", this.pauseBtn]);
    for (const [name, btn] of buttons) {
      if (Math.abs(x - btn.cx) <= btn.hw && Math.abs(y - btn.cy) <= btn.hh) {
        result.push(name);
      }
    }
    return result;
  }

  private isButtonDown(name: ButtonName): boolean {
    for (const held of this.pointerButtons.values()) {
      if (held.includes(name)) return true;
    }
    return false;
  }

  // ── Private — visuals ──────────────────────────────────────────────────

  private refreshButtonVisuals(): void {
    this.setButtonPressed(this.leftBtn, this.isButtonDown("left"));
    this.setButtonPressed(this.rightBtn, this.isButtonDown("right"));
    this.setButtonPressed(this.jumpBtn, this.isButtonDown("jump"));
    if (this.pauseControlEnabled) this.setButtonPressed(this.pauseBtn, this.isButtonDown("pause"));
  }

  // Tweens only fire on a real state change (guarded by btn.pressed), so holding
  // a button never stacks tweens frame-to-frame.
  private setButtonPressed(btn: ControlButton, pressed: boolean): void {
    if (btn.pressed === pressed) return;
    btn.pressed = pressed;

    // Fill + ring update instantly; scale + cyan glow animate.
    btn.glass
      .setFillStyle(UI_COLORS.panelSoft, pressed ? UI_CONTROL.pressedFillAlpha : btn.idleAlpha)
      .setStrokeStyle(UI_STROKE.bold, UI_COLORS.ice, pressed ? 0.95 : 0.5);

    this.scene.tweens.killTweensOf([btn.root, btn.glow]);
    this.scene.tweens.add({
      targets: btn.root,
      scale: pressed ? UI_CONTROL.pressedScale : 1,
      duration: UI_MOTION.buttonPressMs,
      ease: pressed ? "Cubic.easeOut" : "Back.easeOut",
    });
    this.scene.tweens.add({
      targets: btn.glow,
      alpha: pressed ? UI_CONTROL.glowAlpha : 0,
      duration: UI_MOTION.buttonPressMs,
      ease: "Cubic.easeOut",
    });
  }

  // Snaps a button back to idle with no tween (used on hide / disable).
  private resetButton(btn: ControlButton): void {
    btn.pressed = false;
    this.scene.tweens.killTweensOf([btn.root, btn.glow]);
    btn.root.setScale(1);
    btn.glow.setAlpha(0);
    btn.glass
      .setFillStyle(UI_COLORS.panelSoft, btn.idleAlpha)
      .setStrokeStyle(UI_STROKE.bold, UI_COLORS.border, 0.5);
  }

  private resetAllPressed(): void {
    this.pointerButtons.clear();
    this.jumpJustPressed = false;
    this.pauseJustPressed = false;
    for (const btn of this.allButtons()) this.resetButton(btn);
  }

  private allButtons(): ControlButton[] {
    return [this.leftBtn, this.rightBtn, this.jumpBtn, this.pauseBtn];
  }
}
