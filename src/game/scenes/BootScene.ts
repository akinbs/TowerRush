import Phaser from "phaser";
import { SCENE_BOOT, SCENE_PRELOAD } from "../utils/constants";
import { YouTubePlayablesBridge } from "../integrations/youtube/YouTubePlayablesBridge";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_BOOT });
  }

  create(): void {
    // First scene to run → Phaser is booted and about to render its first
    // frame. Signal firstFrameReady() here (idempotent in the bridge). This
    // must precede gameReady(), which fires later from GameScene.
    YouTubePlayablesBridge.getInstance().markFirstFrameReady();

    this.scene.start(SCENE_PRELOAD);
  }
}
