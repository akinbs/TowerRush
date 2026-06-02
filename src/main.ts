import Phaser from "phaser";
import { buildGameConfig } from "./game/config/gameConfig";
import { YouTubePlayablesBridge } from "./game/integrations/youtube/YouTubePlayablesBridge";

// Instantiate the bridge before Phaser boots so the SDK pause/resume/audio
// callbacks are registered as early as possible (the SDK script in index.html
// runs before this module). firstFrameReady()/gameReady() are signalled later
// from BootScene / GameScene respectively.
YouTubePlayablesBridge.getInstance();

new Phaser.Game(buildGameConfig());
