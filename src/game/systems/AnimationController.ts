import Phaser from "phaser";
import { PLAYER_ANIM_DEFS } from "../config/animationConfig";

export class AnimationController {
  // Registers all player animations with the global AnimationManager.
  // Safe to call multiple times — skips already-registered keys.
  static register(scene: Phaser.Scene): void {
    for (const def of PLAYER_ANIM_DEFS) {
      if (scene.anims.exists(def.key)) continue;
      scene.anims.create({
        key: def.key,
        frames: scene.anims.generateFrameNumbers(def.textureKey, { frames: def.frames }),
        frameRate: def.frameRate,
        repeat: def.repeat,
      });
    }
  }
}
