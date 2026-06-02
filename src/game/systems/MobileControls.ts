import Phaser from "phaser";
import type { InputState } from "../types/gameTypes";
import { UI_CONFIG } from "../config/uiConfig";

type ButtonName = "left" | "right" | "jump" | "pause";

interface ButtonWidget {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** Center X in game logical (canvas) space. */
  cx: number;
  /** Center Y in game logical (canvas) space. */
  cy: number;
  hw: number; // half-width  (for hit testing)
  hh: number; // half-height (for hit testing)
}

export class MobileControls {
  private readonly scene: Phaser.Scene;

  private leftBtn!: ButtonWidget;
  private rightBtn!: ButtonWidget;
  private jumpBtn!: ButtonWidget;
  private pauseBtn!: ButtonWidget;

  // Per-pointer tracking: pointer ID → which buttons it is currently holding.
  private readonly pointerButtons = new Map<number, ButtonName[]>();

  // One-shot flags — consumed on the next getState() call.
  private jumpJustPressed = false;
  private pauseJustPressed = false;

  private readonly resizeHandler: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Support up to 4 simultaneous touch points (movement + jump + incidental).
    scene.input.addPointer(3);

    this.createButtons();
    this.registerPointerEvents();

    this.resizeHandler = () => { this.updateLayout(); };
    scene.scale.on("resize", this.resizeHandler);
  }

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
    for (const btn of [this.leftBtn, this.rightBtn, this.jumpBtn, this.pauseBtn]) {
      btn.bg.setVisible(visible);
      btn.label.setVisible(visible);
    }
  }

  destroy(): void {
    this.scene.scale.off("resize", this.resizeHandler);
    for (const btn of [this.leftBtn, this.rightBtn, this.jumpBtn, this.pauseBtn]) {
      btn.bg.destroy();
      btn.label.destroy();
    }
  }

  // ── Private — layout ───────────────────────────────────────────────────

  private createButtons(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const sz = UI_CONFIG.buttonSize;
    const psz = UI_CONFIG.pauseButtonSize;
    const pad = UI_CONFIG.buttonPadding;

    const bottomY = H - pad - sz / 2;
    this.leftBtn  = this.makeButton(pad + sz / 2,             bottomY, sz, sz, "◀");
    this.rightBtn = this.makeButton(pad + sz + pad + sz / 2,  bottomY, sz, sz, "▶");
    this.jumpBtn  = this.makeButton(W - pad - sz / 2,         bottomY, sz, sz, "▲");
    this.pauseBtn = this.makeButton(W - pad - psz / 2, pad + psz / 2, psz, psz, "Ⅱ",
      UI_CONFIG.buttonFillPause);
  }

  updateLayout(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const sz = UI_CONFIG.buttonSize;
    const psz = UI_CONFIG.pauseButtonSize;
    const pad = UI_CONFIG.buttonPadding;

    const bottomY = H - pad - sz / 2;
    this.moveButton(this.leftBtn,  pad + sz / 2,             bottomY, sz, sz);
    this.moveButton(this.rightBtn, pad + sz + pad + sz / 2,  bottomY, sz, sz);
    this.moveButton(this.jumpBtn,  W - pad - sz / 2,         bottomY, sz, sz);
    this.moveButton(this.pauseBtn, W - pad - psz / 2, pad + psz / 2, psz, psz);
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    fillColor: number = UI_CONFIG.buttonFillNormal,
  ): ButtonWidget {
    const bg = this.scene.add
      .rectangle(cx, cy, w, h, fillColor)
      .setScrollFactor(0)
      .setAlpha(UI_CONFIG.buttonAlpha)
      .setDepth(UI_CONFIG.buttonDepth);

    const text = this.scene.add
      .text(cx, cy, label, { fontSize: "22px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(UI_CONFIG.buttonDepth)
      .setOrigin(0.5, 0.5);

    return { bg, label: text, cx, cy, hw: w / 2, hh: h / 2 };
  }

  private moveButton(btn: ButtonWidget, cx: number, cy: number, w: number, h: number): void {
    btn.cx = cx;
    btn.cy = cy;
    btn.hw = w / 2;
    btn.hh = h / 2;
    btn.bg.setPosition(cx, cy).setSize(w, h);
    btn.label.setPosition(cx, cy);
  }

  // ── Private — input ────────────────────────────────────────────────────

  private registerPointerEvents(): void {
    this.scene.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      this.onPointerDown(ptr.id, ptr.x, ptr.y);
    });
    this.scene.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      this.onPointerUp(ptr.id);
    });
    // Cancel buttons if pointer leaves the canvas.
    this.scene.input.on("pointerout", (ptr: Phaser.Input.Pointer) => {
      this.onPointerUp(ptr.id);
    });
  }

  private onPointerDown(ptrId: number, x: number, y: number): void {
    const wasJumpDown = this.isButtonDown("jump");
    const wasPauseDown = this.isButtonDown("pause");

    const hit = this.getHitButtons(x, y);
    if (hit.length === 0) return;

    this.pointerButtons.set(ptrId, hit);

    // Set one-shot flags for newly activated buttons.
    if (!wasJumpDown && this.isButtonDown("jump")) {
      this.jumpJustPressed = true;
    }
    if (!wasPauseDown && this.isButtonDown("pause")) {
      this.pauseJustPressed = true;
    }

    this.refreshButtonVisuals();
  }

  private onPointerUp(ptrId: number): void {
    if (!this.pointerButtons.has(ptrId)) return;
    this.pointerButtons.delete(ptrId);
    this.refreshButtonVisuals();
  }

  private getHitButtons(x: number, y: number): ButtonName[] {
    const result: ButtonName[] = [];
    const buttons: [ButtonName, ButtonWidget][] = [
      ["left",  this.leftBtn],
      ["right", this.rightBtn],
      ["jump",  this.jumpBtn],
      ["pause", this.pauseBtn],
    ];
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

  private refreshButtonVisuals(): void {
    this.tintButton(this.leftBtn,  this.isButtonDown("left"),  UI_CONFIG.buttonFillNormal, UI_CONFIG.buttonFillPressed);
    this.tintButton(this.rightBtn, this.isButtonDown("right"), UI_CONFIG.buttonFillNormal, UI_CONFIG.buttonFillPressed);
    this.tintButton(this.jumpBtn,  this.isButtonDown("jump"),  UI_CONFIG.buttonFillNormal, UI_CONFIG.buttonFillPressed);
    this.tintButton(this.pauseBtn, this.isButtonDown("pause"), UI_CONFIG.buttonFillPause,  UI_CONFIG.buttonFillPausePressed);
  }

  private tintButton(btn: ButtonWidget, pressed: boolean, normal: number, active: number): void {
    btn.bg.setFillStyle(pressed ? active : normal);
  }
}
