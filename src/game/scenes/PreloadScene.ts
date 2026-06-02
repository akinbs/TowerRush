import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GROUND_HEIGHT,
  PLATFORM_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SCENE_GAME,
  SCENE_PRELOAD,
  TEX_GROUND,
  TEX_PLATFORM,
  TEX_PLAYER,
} from "../utils/constants";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_PRELOAD });
  }

  create(): void {
    this.generatePlaceholderTextures();
    this.scene.start(SCENE_GAME);
  }

  // Generates solid-color rectangle textures so the game runs without
  // external assets. Replace with real sprite sheets in a later step.
  private generatePlaceholderTextures(): void {
    this.createRectTexture(TEX_PLAYER, PLAYER_WIDTH, PLAYER_HEIGHT, 0x44aaff);
    this.createRectTexture(TEX_PLATFORM, 100, PLATFORM_HEIGHT, 0x88ccff);
    this.createRectTexture(TEX_GROUND, GAME_HEIGHT, GROUND_HEIGHT, 0x5599cc);
  }

  private createRectTexture(key: string, w: number, h: number, color: number): void {
    if (this.textures.exists(key)) return;

    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
