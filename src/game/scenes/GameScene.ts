import Phaser from "phaser";
import { GROUND_SURFACE_Y, SCENE_GAME, WORLD_HEIGHT } from "../utils/constants";
import { Player } from "../entities/Player";
import { InputController } from "../systems/InputController";
import { CameraController } from "../systems/CameraController";
import { HudController } from "../systems/HudController";
import { ScoreController } from "../systems/ScoreController";
import { FallDeathController } from "../systems/FallDeathController";
import { GameOverController } from "../systems/GameOverController";
import { PlatformManager } from "../managers/PlatformManager";
import { INITIAL_PHASE } from "../config/towerConfig";
import type { GameState } from "../types/gameTypes";

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputController!: InputController;
  private cameraController!: CameraController;
  private platformManager!: PlatformManager;
  private hudController!: HudController;
  private scoreController!: ScoreController;
  private fallDeathController!: FallDeathController;
  private gameOverController!: GameOverController;

  private gameState: GameState = "playing";

  constructor() {
    super({ key: SCENE_GAME });
  }

  create(): void {
    this.gameState = "playing";
    this.physics.world.setBounds(0, 0, this.scale.width, WORLD_HEIGHT);

    this.platformManager = new PlatformManager(this, INITIAL_PHASE);
    this.platformManager.createInitialPlatforms();

    this.player = new Player(this, INITIAL_PHASE);
    this.inputController = new InputController(this);
    this.cameraController = new CameraController(this);

    this.scoreController = new ScoreController();
    this.scoreController.startRun(GROUND_SURFACE_Y);

    this.hudController = new HudController(this, INITIAL_PHASE.name);
    this.fallDeathController = new FallDeathController();
    this.gameOverController = new GameOverController(this);

    this.physics.add.collider(
      this.player.gameObject,
      this.platformManager.platformGroup,
    );

    // Clean up all controllers before scene.restart() reinitialises create().
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.onShutdown(); });

    // TODO: YouTube Playables SDK — call ytgame.game.gameReady() here.
  }

  update(time: number, delta: number): void {
    const input = this.inputController.getState();

    // ── Game Over state ────────────────────────────────────────────────────
    if (this.gameState === "gameOver") {
      if (input.restartPressed || this.gameOverController.consumeRestartPressed()) {
        this.restartRun();
      }
      return;
    }

    // ── Pause toggle — always handled, skips physics this frame ───────────
    if (input.pausePressed) {
      this.togglePause();
      this.hudController.update(this.scoreController.getSnapshot(), this.gameState === "paused");
      return;
    }

    // HUD refreshes every frame (shows PAUSED overlay when needed).
    this.hudController.update(this.scoreController.getSnapshot(), this.gameState === "paused");

    if (this.gameState === "paused") return;

    // ── Playing ────────────────────────────────────────────────────────────

    // 1. Player physics (coyote time + jump buffer use time, not delta).
    this.player.update(input, time, delta);

    // 2. Camera — lerp toward player, fast when falling.
    this.cameraController.update(this.player, delta);

    // 3. Generate ahead, clean up below.
    this.platformManager.update(
      this.player.getPosition().y,
      this.cameras.main.scrollY,
    );

    // 4. Score / height tracking.
    this.scoreController.update(this.player.getPosition().y);

    // 5. Fall death check.
    this.fallDeathController.update(this.player);
    const deathReason = this.fallDeathController.checkDeath(this.player);
    if (deathReason !== null) {
      this.triggerGameOver();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────

  private togglePause(): void {
    if (this.gameState === "playing") {
      this.gameState = "paused";
      this.physics.pause();
    } else if (this.gameState === "paused") {
      this.gameState = "playing";
      this.physics.resume();
    }
  }

  private triggerGameOver(): void {
    this.gameState = "gameOver";
    this.physics.pause();
    this.hudController.setVisible(false);
    this.inputController.setMobileControlsVisible(false);
    this.gameOverController.show(this.scoreController.getSnapshot());
  }

  private restartRun(): void {
    this.scene.restart();
  }

  private onShutdown(): void {
    this.hudController.destroy();
    this.inputController.destroy();
    this.gameOverController.destroy();
  }
}
