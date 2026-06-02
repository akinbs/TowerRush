import Phaser from "phaser";
import { SCENE_BOOT, SCENE_PRELOAD } from "../utils/constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_BOOT });
  }

  create(): void {
    // TODO: YouTube Playables SDK — call ytgame.game.firstFrameReady() here
    // after Phaser has rendered its first frame.

    this.scene.start(SCENE_PRELOAD);
  }
}
