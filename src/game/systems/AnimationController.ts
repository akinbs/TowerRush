import Phaser from "phaser";
import { PLAYER_ANIM_DEFS, PLAYER_DIRECTIONS } from "../config/animationConfig";

export class AnimationController {
  // Registers all player animations with the global AnimationManager — every
  // base def once per facing direction (key = base + "-r"/"-l", bound to that
  // direction's sheet). Safe to call multiple times; already-registered keys
  // are skipped. Works identically for the loaded sheets and the generated
  // fallback, since both expose the same 12-frame layout under the same keys.
  static register(scene: Phaser.Scene): void {
    for (const dir of PLAYER_DIRECTIONS) {
      for (const def of PLAYER_ANIM_DEFS) {
        const key = def.key + dir.suffix;
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(dir.textureKey, { frames: def.frames }),
          frameRate: def.frameRate,
          repeat: def.repeat,
        });
      }
    }
  }
}
