import Phaser from "phaser";
import { GAME_WIDTH, GROUND_SURFACE_Y, SCENE_GAME, WORLD_HEIGHT } from "../utils/constants";
import { Platform } from "../entities/Platform";
import { Player } from "../entities/Player";
import { InputController } from "../systems/InputController";
import { CameraController } from "../systems/CameraController";
import { HudController } from "../systems/HudController";
import { ScoreController } from "../systems/ScoreController";
import { FallDeathController } from "../systems/FallDeathController";
import { GameOverController } from "../systems/GameOverController";
import { TowerCompletionController } from "../systems/TowerCompletionController";
import { PlatformManager } from "../managers/PlatformManager";
import { TowerPhaseController } from "../systems/TowerPhaseController";
import { AudioStateController } from "../systems/AudioStateController";
import { YouTubePlayablesBridge } from "../integrations/youtube/YouTubePlayablesBridge";
import { SaveController } from "../integrations/youtube/SaveController";
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
  private towerCompletionController!: TowerCompletionController;
  private towerPhaseController!: TowerPhaseController;

  // Last platform the player was confirmed standing on (set each frame by the
  // collision callback). Used to carry the player on moving platforms.
  private currentGroundPlatform: Platform | null = null;

  // Set to true by the collider callback whenever it fires and the player is
  // grounded. Cleared at the top of each update(). If still false at the top
  // of update() it means no collision fired this frame → reference is stale.
  private groundPlatformSetThisFrame = false;

  private gameState: GameState = "playing";

  // Platform (YouTube) pause is orthogonal to the GameState machine: it freezes
  // everything regardless of user pause / gameOver / towerComplete, then on
  // resume only restarts physics if the run was actively playing.
  private isPlatformPaused = false;

  // Unsubscribe handles for the bridge fan-out — called on SHUTDOWN so scene
  // restarts never leak or duplicate platform pause/resume listeners.
  private unsubPlatformPause: (() => void) | null = null;
  private unsubPlatformResume: (() => void) | null = null;

  constructor() {
    super({ key: SCENE_GAME });
  }

  create(): void {
    this.gameState = "playing";
    this.physics.world.setBounds(0, 0, this.scale.width, WORLD_HEIGHT);

    this.towerPhaseController = new TowerPhaseController();

    this.platformManager = new PlatformManager(
      this,
      INITIAL_PHASE,
      (platformY) => this.towerPhaseController.choosePlatformType(platformY),
    );
    this.platformManager.createInitialPlatforms();

    this.player = new Player(this, INITIAL_PHASE);
    this.inputController = new InputController(this);
    this.cameraController = new CameraController(this);

    this.scoreController = new ScoreController();
    this.scoreController.startRun(GROUND_SURFACE_Y);

    this.hudController = new HudController(this, INITIAL_PHASE.name);
    this.fallDeathController = new FallDeathController();
    this.gameOverController = new GameOverController(this);
    this.towerCompletionController = new TowerCompletionController(this);

    this.physics.add.collider(
      this.player.gameObject,
      this.platformManager.platformGroup,
      (_playerGO, platformGO) => {
        // isGrounded() uses body.blocked.down || body.touching.down.
        // Side / bottom contact never sets these flags, so the guard implicitly
        // restricts all callbacks below to top-contact only.
        if (!this.player.isGrounded()) return;

        // Mark that a grounded collision fired this frame so the stale-reference
        // guard in update() keeps currentGroundPlatform rather than clearing it.
        this.groundPlatformSetThisFrame = true;

        const platform = this.platformManager.getPlatformByGameObject(
          platformGO as Phaser.GameObjects.GameObject,
        );

        if (platform) {
          this.player.setGroundPlatformType(platform.getType());
          this.currentGroundPlatform = platform;
          if (platform.isBreakable()) {
            platform.triggerBreak();
          }
        } else {
          // Ground tile (no Platform entity) — neutral friction, no carry.
          this.player.setGroundPlatformType(null);
          this.currentGroundPlatform = null;
        }
      },
    );

    // Clean up all controllers before scene.restart() reinitialises create().
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.onShutdown(); });

    // ── YouTube Playables wiring ──────────────────────────────────────────
    const bridge = YouTubePlayablesBridge.getInstance();
    this.unsubPlatformPause = bridge.onPlatformPause(() => this.handlePlatformPause());
    this.unsubPlatformResume = bridge.onPlatformResume(() => this.handlePlatformResume());
    // Touch the audio controller so it initialises and tracks host audio state.
    AudioStateController.getInstance();

    // Load cloud save (once), then signal gameReady() — the game is fully
    // interactive at this point and save state is available for this run.
    void this.initializePlayablesAsync();
  }

  update(time: number, delta: number): void {
    const input = this.inputController.getState();

    // ── Stale ground-platform guard ────────────────────────────────────────
    // Physics (and collider callbacks) runs BEFORE scene.update() in Phaser's
    // loop. If the collider fired this frame, groundPlatformSetThisFrame was
    // set to true. If it didn't fire (player is airborne or walked off the
    // edge), the reference from a previous frame is stale → clear it.
    if (!this.groundPlatformSetThisFrame) {
      this.currentGroundPlatform = null;
    }
    this.groundPlatformSetThisFrame = false;

    // ── Platform (YouTube) pause ───────────────────────────────────────────
    // Highest priority: when the host pauses us, freeze ALL execution — no
    // physics, no input, no fall death, no restart. Only refresh the HUD's
    // paused overlay while a run is in progress (end-of-run overlays own the
    // screen otherwise).
    if (this.isPlatformPaused) {
      if (this.gameState === "playing" || this.gameState === "paused") {
        this.hudController.update(
          this.scoreController.getSnapshot(),
          true,
          this.towerPhaseController.getCurrentPhaseName(),
        );
      }
      return;
    }

    // ── Game Over state ────────────────────────────────────────────────────
    if (this.gameState === "gameOver") {
      if (input.restartPressed || this.gameOverController.consumeRestartPressed()) {
        this.restartRun();
      }
      return;
    }

    // ── Tower Complete state ─────────────────────────────────────────────────
    // No pause, no physics, no fall death — only restart (R / button) is live.
    // consumeContinuePressed() is wired for the future second tower but the
    // continue button is a disabled placeholder, so it never fires this step.
    if (this.gameState === "towerComplete") {
      if (input.restartPressed || this.towerCompletionController.consumeRestartPressed()) {
        this.restartRun();
      }
      this.towerCompletionController.consumeContinuePressed();
      return;
    }

    // ── Pause toggle — always handled, skips physics this frame ───────────
    if (input.pausePressed) {
      this.togglePause();
      this.hudController.update(
        this.scoreController.getSnapshot(),
        this.gameState === "paused",
        this.towerPhaseController.getCurrentPhaseName(),
      );
      return;
    }

    // HUD refreshes every frame (shows PAUSED overlay when needed).
    this.hudController.update(
      this.scoreController.getSnapshot(),
      this.gameState === "paused",
      this.towerPhaseController.getCurrentPhaseName(),
    );

    if (this.gameState === "paused") return;

    // ── Playing ────────────────────────────────────────────────────────────

    // 1. Tick platform states (breakable + moving) first so deltaX is fresh
    //    before player input and carry are applied in the same frame.
    this.platformManager.update(
      this.player.getPosition().y,
      this.cameras.main.scrollY,
      delta,
    );

    // 2. Player physics — input, friction, coyote time, jump buffer.
    this.player.update(input, time, delta);

    // 2.5 Tower completion — top-contact with the goal platform wins over
    //     everything else this frame. currentGroundPlatform is only set by the
    //     collider on confirmed top-contact (side/bottom never set it), and the
    //     stale guard at the top of update() clears it when no collision fired.
    //     Checking here (before fall death) makes the summit a safe finish: a
    //     hard landing on the goal completes the tower instead of killing.
    if (
      this.currentGroundPlatform !== null &&
      this.currentGroundPlatform.isGoal() &&
      this.player.isGrounded()
    ) {
      this.triggerTowerComplete();
      return;
    }

    // 3. Moving platform carry — shift player by exactly the platform's
    //    deltaX this frame. Input velocity is preserved; player remains free
    //    to walk left/right independently. Only applies when the collider
    //    confirmed top-contact this frame (groundPlatformSetThisFrame guard
    //    above ensures currentGroundPlatform is never stale).
    if (
      this.player.isGrounded() &&
      this.currentGroundPlatform !== null &&
      this.currentGroundPlatform.isMoving() &&
      !this.currentGroundPlatform.isBroken()
    ) {
      this.player.applyExternalHorizontalDelta(
        this.currentGroundPlatform.getDeltaX(),
      );
    }

    // 4. Horizontal wrap — after carry so the final position is checked.
    this.player.applyHorizontalWrap(GAME_WIDTH);

    // 5. Camera — lerp toward player, fast when falling.
    this.cameraController.update(this.player, delta);

    // 6. Score / height tracking.
    this.scoreController.update(this.player.getPosition().y);

    // 7. Tower phase — update based on current height.
    this.towerPhaseController.update(this.scoreController.getSnapshot().currentHeightMeters);

    // 8. Fall death — after player.update() so grounded/velocity are current.
    const snapshot = this.scoreController.getSnapshot();
    this.fallDeathController.update(this.player, snapshot);
    if (this.fallDeathController.shouldTriggerDeath()) {
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
    // Overlay is already up; persistence/score happen in the background.
    void this.handleRunFinished(null);
  }

  private triggerTowerComplete(): void {
    this.gameState = "towerComplete";
    this.physics.pause();
    this.hudController.setVisible(false);
    this.inputController.setMobileControlsVisible(false);
    this.towerCompletionController.show(this.scoreController.getSnapshot());
    void this.handleRunFinished(INITIAL_PHASE.id);
  }

  // ── YouTube Playables integration ────────────────────────────────────────

  private async initializePlayablesAsync(): Promise<void> {
    const save = SaveController.getInstance();
    // initialize() is idempotent: the cloud load happens once across all
    // restarts, later calls resolve immediately.
    await save.initialize();
    // gameReady() is idempotent in the bridge — only the first run signals it.
    YouTubePlayablesBridge.getInstance().markGameReady();
  }

  private handlePlatformPause(): void {
    if (this.isPlatformPaused) return;
    this.isPlatformPaused = true;
    // pause() is safe even if physics is already paused (user pause / end run).
    this.physics.pause();
    // Checkpoint progress — a backgrounded playable may be discarded.
    this.saveCheckpoint();
  }

  private handlePlatformResume(): void {
    if (!this.isPlatformPaused) return;
    this.isPlatformPaused = false;
    // Only resume physics when the run was actively playing. User pause keeps
    // it paused; gameOver / towerComplete must stay frozen.
    if (this.gameState === "playing") {
      this.physics.resume();
    }
  }

  // Saves best-so-far on platform pause. Never sends a score (that is reserved
  // for end-of-run). No-ops cleanly if the cloud load hasn't completed.
  private saveCheckpoint(): void {
    const save = SaveController.getInstance();
    if (!save.hasLoaded()) return;
    const snapshot = this.scoreController.getSnapshot();
    save.updateBest(snapshot.score, snapshot.bestHeightMeters);
    void save.save();
  }

  // Runs after the overlay is shown. Updates best score/height, submits a new
  // high score only when it improved, and persists. All errors are swallowed
  // inside the bridge so a failed save/score never breaks the game.
  private async handleRunFinished(completedTowerId: string | null): Promise<void> {
    const save = SaveController.getInstance();
    // Honour load-before-save: if the cloud load hasn't finished, skip rather
    // than risk clobbering unread data.
    if (!save.hasLoaded()) return;

    if (completedTowerId !== null) {
      save.markTowerCompleted(completedTowerId);
    }

    const snapshot = this.scoreController.getSnapshot();
    const scoreImproved = save.updateBest(snapshot.score, snapshot.bestHeightMeters);

    if (scoreImproved) {
      await YouTubePlayablesBridge.getInstance().sendScore(snapshot.score);
    }
    await save.save();
  }

  private restartRun(): void {
    // Physics is paused in gameOver / towerComplete — resume before the scene
    // tears down so the fresh run starts with a running physics world.
    this.physics.resume();
    this.scene.restart();
  }

  private onShutdown(): void {
    this.hudController.destroy();
    this.inputController.destroy();
    this.gameOverController.destroy();
    this.towerCompletionController.destroy();

    // Detach platform pause/resume subscribers so the next GameScene instance
    // re-subscribes cleanly (the SDK callback itself stays registered once).
    this.unsubPlatformPause?.();
    this.unsubPlatformResume?.();
    this.unsubPlatformPause = null;
    this.unsubPlatformResume = null;
  }
}
