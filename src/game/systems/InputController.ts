import Phaser from "phaser";
import type { InputState } from "../types/gameTypes";
import { MobileControls } from "./MobileControls";

export class InputController {
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    leftAlt: Phaser.Input.Keyboard.Key;
    rightAlt: Phaser.Input.Keyboard.Key;
    jumpAlt: Phaser.Input.Keyboard.Key;
    jumpUp: Phaser.Input.Keyboard.Key;
    pause: Phaser.Input.Keyboard.Key;
    pauseAlt: Phaser.Input.Keyboard.Key;
    restart: Phaser.Input.Keyboard.Key;
  };

  private readonly mobile: MobileControls;

  // One-shot keyboard flags — consumed after one getState() call.
  private jumpPressedThisFrame    = false;
  private pausePressedThisFrame   = false;
  private restartPressedThisFrame = false;

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;

    this.keys = {
      left:      kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      jump:      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      leftAlt:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      rightAlt:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jumpAlt:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      jumpUp:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      pause:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      pauseAlt:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      restart:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    this.registerOneShotKeys();
    this.mobile = new MobileControls(scene);
  }

  // Returns the merged input state for the current frame.
  getState(): InputState {
    const mob = this.mobile.getState();

    const left  = this.keys.left.isDown  || this.keys.leftAlt.isDown  || mob.left;
    const right = this.keys.right.isDown || this.keys.rightAlt.isDown || mob.right;

    const jumpHeld = this.keys.jump.isDown || this.keys.jumpAlt.isDown ||
                     this.keys.jumpUp.isDown || mob.jumpHeld;

    const jumpPressed    = this.jumpPressedThisFrame    || mob.jumpPressed;
    const pausePressed   = this.pausePressedThisFrame   || mob.pausePressed;
    const restartPressed = this.restartPressedThisFrame || mob.pausePressed && false; // keyboard only

    // Consume one-shot keyboard flags after merging.
    this.jumpPressedThisFrame    = false;
    this.pausePressedThisFrame   = false;
    this.restartPressedThisFrame = false;

    return { left, right, jumpPressed, jumpHeld, pausePressed, restartPressed };
  }

  setMobileControlsVisible(visible: boolean): void {
    this.mobile.setVisible(visible);
  }

  destroy(): void {
    this.mobile.destroy();
  }

  // ── Private ────────────────────────────────────────────────────────────

  private registerOneShotKeys(): void {
    const setJump    = (): void => { this.jumpPressedThisFrame    = true; };
    const setPause   = (): void => { this.pausePressedThisFrame   = true; };
    const setRestart = (): void => { this.restartPressedThisFrame = true; };

    this.keys.jump.on("down",     setJump);
    this.keys.jumpAlt.on("down",  setJump);
    this.keys.jumpUp.on("down",   setJump);
    this.keys.pause.on("down",    setPause);
    this.keys.pauseAlt.on("down", setPause);
    this.keys.restart.on("down",  setRestart);
  }
}
