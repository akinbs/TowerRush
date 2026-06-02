import Phaser from "phaser";
import { buildGameConfig } from "./game/config/gameConfig";

// TODO: YouTube Playables SDK — import and initialize here before Phaser boots
// import { ytgame } from "...";
// ytgame.game.firstFrameReady() → call after first frame renders (hook in BootScene)
// ytgame.game.gameReady()      → call when game is fully interactive (hook in GameScene)

new Phaser.Game(buildGameConfig());
