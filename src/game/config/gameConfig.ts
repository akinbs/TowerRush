import Phaser from "phaser";
import { physicsConfig } from "./physicsConfig";
import { GAME_HEIGHT, GAME_WIDTH } from "../utils/constants";
import { BootScene } from "../scenes/BootScene";
import { PreloadScene } from "../scenes/PreloadScene";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { GameScene } from "../scenes/GameScene";

export function buildGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#1a1a2e",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    physics: physicsConfig,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: [BootScene, PreloadScene, MainMenuScene, GameScene],
  };
}
