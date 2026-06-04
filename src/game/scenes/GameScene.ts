import Phaser from "phaser";
import { GAME_WIDTH, GROUND_SURFACE_Y, MOVING_PLATFORM_CARRY_MAX_UP_VELOCITY, SCENE_GAME, SCENE_MAIN_MENU, WORLD_HEIGHT } from "../utils/constants";
import { Platform } from "../entities/Platform";
import { Player } from "../entities/Player";
import { InputController } from "../systems/InputController";
import { CameraController } from "../systems/CameraController";
import { HudController } from "../systems/HudController";
import { PauseOverlayController } from "../systems/PauseOverlayController";
import { ScoreController } from "../systems/ScoreController";
import { FallDeathController } from "../systems/FallDeathController";
import { GameOverController } from "../systems/GameOverController";
import { TowerCompletionController } from "../systems/TowerCompletionController";
import { PlatformManager } from "../managers/PlatformManager";
import { ProjectileManager } from "../managers/ProjectileManager";
import { HailstoneManager } from "../managers/HailstoneManager";
import { TowerPhaseController } from "../systems/TowerPhaseController";
import { HazardEventScheduler } from "../systems/HazardEventScheduler";
import { SnowController } from "../systems/SnowController";
import { AudioStateController } from "../systems/AudioStateController";
import { SfxController } from "../systems/SfxController";
import { FxController } from "../systems/FxController";
import { YouTubePlayablesBridge } from "../integrations/youtube/YouTubePlayablesBridge";
import { SaveController } from "../integrations/youtube/SaveController";
import { INITIAL_PHASE } from "../config/towerConfig";
import { AUDIO_CONFIG } from "../config/audioConfig";
import { FX_CONFIG } from "../config/fxConfig";
import { HAZARD_CONFIG } from "../config/hazardConfig";
import { SNOW_CONFIG } from "../config/snowConfig";
import type { GameState, HailstoneHitPayload, HazardEventPayload, HazardSide, InputState, ProjectileHitPayload } from "../types/gameTypes";

const IS_DEV = import.meta.env.DEV;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputController!: InputController;
  private cameraController!: CameraController;
  private platformManager!: PlatformManager;
  private hudController!: HudController;
  private pauseOverlay!: PauseOverlayController;
  private scoreController!: ScoreController;
  private fallDeathController!: FallDeathController;
  private gameOverController!: GameOverController;
  private towerCompletionController!: TowerCompletionController;
  private towerPhaseController!: TowerPhaseController;
  private hazardScheduler!: HazardEventScheduler;
  private snowController!: SnowController;
  private hailstoneManager!: HailstoneManager;
  private projectileManager!: ProjectileManager;
  // Dev-only manual projectile fire key (T). Null in production.
  private debugFireKey: Phaser.Input.Keyboard.Key | null = null;
  // Dev-only snow toggle key (Y). Null in production.
  private debugSnowKey: Phaser.Input.Keyboard.Key | null = null;
  private sfx!: SfxController;
  private fx!: FxController;

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

  // Set by the HUD pause button; consumed once in update() to toggle pause,
  // sharing the same path as keyboard/mobile pause input.
  private pauseTogglePending = false;

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
    // Hazard timing infrastructure (Step 12). Emits scheduled events only; the
    // real projectile/snow systems consume them.
    this.hazardScheduler = new HazardEventScheduler();
    // Snow Time weather + caps (Step 14).
    this.snowController = new SnowController(this);

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

    this.hudController = new HudController(this, {
      onPausePressed: () => { this.pauseTogglePending = true; },
    });
    // Pause now lives in the HUD button → disable the on-screen mobile pause
    // button so the two can't double-toggle (movement controls untouched).
    this.inputController.setMobilePauseControlEnabled(false);

    // User-pause modal (Resume / Restart / Main Menu / Sound). Resume reuses the
    // single pause-toggle path so keyboard / HUD / overlay can never double-fire.
    this.pauseOverlay = new PauseOverlayController(this, {
      onResume: () => { this.pauseTogglePending = true; },
      onRestart: () => this.restartRun(),
      onMainMenu: () => this.returnToMainMenu(),
      onToggleSound: () => this.togglePauseSound(),
    });
    this.fallDeathController = new FallDeathController();
    this.gameOverController = new GameOverController(this, {
      onRestart: () => this.restartRun(),
      onMainMenu: () => this.returnToMainMenu(),
    });
    this.towerCompletionController = new TowerCompletionController(this, {
      onRestart: () => this.restartRun(),
      onMainMenu: () => this.returnToMainMenu(),
    });

    // Side projectile hazard (Step 13). Driven by the scheduler's warning/fire
    // events; bounces off platforms and knocks the player back (never kills).
    this.projectileManager = new ProjectileManager({
      scene: this,
      platformGroup: this.platformManager.platformGroup,
      player: this.player,
      onPlayerHit: (hit) => this.handleProjectileHit(hit),
    });

    // Hailstones mixed into Snow Time (Step 14.3): bounce, knock back, shatter.
    this.hailstoneManager = new HailstoneManager({
      scene: this,
      platformGroup: this.platformManager.platformGroup,
      player: this.player,
      onPlayerHit: (hit) => this.handleHailstoneHit(hit),
      onShatter: (x, y) => this.fx.playHailstoneShatter(x, y),
    });

    // Dev-only: press T to fire a projectile from a random side at the player,
    // bypassing the height gate, to test visibility/physics without climbing.
    if (IS_DEV) {
      this.debugFireKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.T) ?? null;
      this.debugSnowKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Y) ?? null;
    }

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
          // triggerBreak() returns true only on the first contact that starts
          // the crack, so the crack SFX/FX play exactly once per breakable.
          if (platform.isBreakable() && platform.triggerBreak()) {
            this.sfx.playCrackStart();
            this.fx.playCrackWarningPulse(platform.gameObject.x, platform.gameObject.y);
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
    // Audio: the controller tracks host audio state; SfxController synthesises
    // the self-contained procedural effects and gates them on that state.
    this.sfx = new SfxController(this, AudioStateController.getInstance());
    // Visual game-feel effects (puffs, shards, shake, pulse) — shares the same
    // gameplay event hooks as the SFX.
    this.fx = new FxController(this);

    // Load cloud save (once), then signal gameReady() — the game is fully
    // interactive at this point and save state is available for this run.
    void this.initializePlayablesAsync();
  }

  update(time: number, delta: number): void {
    const input = this.inputController.getState();

    // Any real input counts as the user gesture that unlocks WebAudio. The call
    // is internally guarded (no-op once the context is running), so calling it
    // every input frame is cheap.
    if (this.hasAnyInput(input)) this.sfx.unlockOnce();

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
        this.refreshHud(true);
      }
      return;
    }

    // ── Game Over state ────────────────────────────────────────────────────
    // Restart buttons fire onRestart directly; only the keyboard R shortcut is
    // polled here (the overlay owns its own button input now).
    if (this.gameState === "gameOver") {
      if (input.restartPressed) this.restartRun();
      return;
    }

    // ── Tower Complete state ─────────────────────────────────────────────────
    // No pause, no physics, no fall death — only restart (R / button) is live.
    // The "Next Tower" placeholder is non-interactive (second tower not built).
    if (this.gameState === "towerComplete") {
      if (input.restartPressed) this.restartRun();
      return;
    }

    // ── Pause toggle — always handled, skips physics this frame ───────────
    // Keyboard/mobile pausePressed and the HUD pause button share one path.
    if (input.pausePressed || this.pauseTogglePending) {
      this.pauseTogglePending = false;
      this.togglePause();
      this.refreshHud(this.gameState === "paused");
      return;
    }

    // HUD refreshes every frame (status badge reflects pause/snow/phase).
    this.refreshHud(this.gameState === "paused");

    if (this.gameState === "paused") return;

    // ── Playing ────────────────────────────────────────────────────────────

    // 1. Tick platform states (breakable + moving) first so deltaX is fresh
    //    before player input and carry are applied in the same frame.
    const platformUpdate = this.platformManager.update(
      this.player.getPosition().y,
      this.cameras.main.scrollY,
      delta,
    );
    if (platformUpdate.brokenPlatformsCount > 0) {
      this.sfx.playPlatformBreak();
      for (const pos of platformUpdate.brokenPlatformPositions) {
        this.fx.playIceBreakParticles(pos.x, pos.y);
      }
    }

    // 2. Player physics — input, friction, coyote time, jump buffer.
    this.player.update(input, time, delta);

    // 2a. Jump SFX + puff fire immediately (never conflicts with other events).
    //     Landing is captured now but played later — only after the fall-death
    //     check below clears, so a fatal landing plays game-over, not land.
    if (this.player.consumeJustJumped()) {
      this.sfx.playJump();
      this.fx.playJumpPuff(this.player.getX(), this.player.getFootY());
    }
    const landing = this.player.consumeJustLanded();

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
      this.player.getVelocityY() >= MOVING_PLATFORM_CARRY_MAX_UP_VELOCITY &&
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

    // 7.5 Hazard scheduling — delta-driven, gated on the playing state. Uses
    //     bestHeightMeters so hazards arm by the difficulty zone reached this
    //     run (the player has proven they can be there, even after a fall).
    //     This step only logs the events; real hazards arrive in later steps.
    const hazardEvents = this.hazardScheduler.update({
      time,
      delta,
      heightMeters: this.scoreController.getSnapshot().bestHeightMeters,
      gameState: this.gameState,
    });
    if (hazardEvents.length > 0) this.handleHazardEvents(hazardEvents);

    // 7.6 Projectile lifetime — cull anything that drifted past the cleanup
    //     window. Spawning/knockback are event-driven (handleHazardEvents /
    //     overlap callback); this only handles cleanup.
    this.projectileManager.update(this.cameras.main.scrollY, this.scale.height);

    // 7.65 Snow weather — advance flakes / cap fades only while playing. While
    //      active, keep every platform (including freshly generated ones) capped.
    this.snowController.update(delta);
    if (this.snowController.isActive()) {
      this.snowController.syncSnowCaps(this.platformManager.getSnowEligiblePlatforms());
    }
    // Hailstones fall/bounce/cleanup with the snow (spawning gated internally).
    this.hailstoneManager.update({
      delta,
      cameraScrollY: this.cameras.main.scrollY,
      viewportHeight: this.scale.height,
    });

    // 7.7 Dev-only manual fire — verify projectile visuals/physics on demand.
    if (IS_DEV && this.debugFireKey && Phaser.Input.Keyboard.JustDown(this.debugFireKey)) {
      const side: HazardSide = Math.random() < 0.5 ? "left" : "right";
      this.projectileManager.fireFromSide({
        side,
        cameraScrollY: this.cameras.main.scrollY,
        playerX: this.player.getX(),
        playerY: this.player.getY(),
        playerVelocityX: this.player.getVelocityX(),
        playerVelocityY: this.player.getVelocityY(),
      });
    }

    // 7.8 Dev-only snow toggle — verify Snow Time without waiting on the scheduler.
    if (IS_DEV && this.debugSnowKey && Phaser.Input.Keyboard.JustDown(this.debugSnowKey)) {
      if (this.snowController.isActive()) {
        this.endSnow();
      } else {
        this.startSnow();
      }
    }

    // 8. Fall death — after player.update() so grounded/velocity are current.
    const snapshot = this.scoreController.getSnapshot();
    this.fallDeathController.update(this.player, snapshot);
    if (this.fallDeathController.shouldTriggerDeath()) {
      this.triggerGameOver();
      return;
    }

    // 9. Land SFX + FX — played last so they never overlap a fatal landing
    //    (which returns above with the game-over shake) or a tower-complete
    //    finish. Gated on a minimum impact speed so soft steps and the spawn
    //    settle stay silent; intensity scales volume, particle count and squash.
    if (landing.landed && landing.velocityY >= AUDIO_CONFIG.landMinVelocityY) {
      this.sfx.playLand(landing.velocityY);
      this.fx.playLandingPuff(this.player.getX(), this.player.getFootY(), landing.velocityY);
      this.player.applyLandingSquash(landing.velocityY);
      // Extra tiny shake only for hard (but survivable) landings.
      if (landing.velocityY >= FX_CONFIG.hardLandingVelocityY) {
        this.fx.playHardLandingShake(landing.velocityY);
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────

  // Pushes the current score/height/phase/snow state into the HUD.
  private refreshHud(isPaused: boolean): void {
    const snapshot = this.scoreController.getSnapshot();
    this.hudController.update({
      score: snapshot.score,
      heightMeters: snapshot.currentHeightMeters,
      bestHeightMeters: snapshot.bestHeightMeters,
      phaseLabel: this.towerPhaseController.getCurrentPhaseName(),
      isPaused,
      isSnowActive: this.snowController.isActive(),
    });
  }

  private togglePause(): void {
    if (this.gameState === "playing") {
      this.gameState = "paused";
      this.physics.pause();
      // Silence any in-flight effect; no new SFX play while paused.
      this.sfx.stopAll();
      const snapshot = this.scoreController.getSnapshot();
      this.pauseOverlay.show({
        score: snapshot.score,
        heightMeters: snapshot.currentHeightMeters,
        bestHeightMeters: snapshot.bestHeightMeters,
        soundEnabled: AudioStateController.getInstance().isAudioEnabled(),
      });
    } else if (this.gameState === "paused") {
      this.gameState = "playing";
      this.physics.resume();
      this.pauseOverlay.hide();
    }
  }

  // Returns to the main menu from the pause modal. Resume physics first so the
  // world isn't torn down frozen; scene.start fires SHUTDOWN → onShutdown() which
  // destroys every controller (HUD, projectiles, snow, hail, FX, SFX, overlay).
  private returnToMainMenu(): void {
    this.physics.resume();
    this.scene.start(SCENE_MAIN_MENU);
  }

  // Pause-modal sound toggle. Mirrors the menu: muting always works, un-muting
  // only while the host permits audio. Reflects the effective state on the icon.
  private togglePauseSound(): void {
    const audio = AudioStateController.getInstance();
    if (!audio.isHostEnabled()) return;
    audio.setUserMuted(!audio.isUserMuted());
    this.pauseOverlay.updateSoundState(audio.isAudioEnabled());
  }

  // Routes scheduler events to the live hazard systems. Snow events stay no-op
  // until Step 14.
  private handleHazardEvents(events: HazardEventPayload[]): void {
    for (const event of events) {
      switch (event.type) {
        case "side_projectile_warning":
          if (event.side) {
            this.projectileManager.showWarning({
              side: event.side,
              cameraScrollY: this.cameras.main.scrollY,
              playerY: this.player.getY(),
            });
            this.hudController.showHazardWarning(event.side);
          }
          break;
        case "side_projectile_fire":
          if (event.side) {
            this.projectileManager.fireFromSide({
              side: event.side,
              cameraScrollY: this.cameras.main.scrollY,
              playerX: this.player.getX(),
              playerY: this.player.getY(),
              playerVelocityX: this.player.getVelocityX(),
              playerVelocityY: this.player.getVelocityY(),
            });
          }
          break;
        case "snow_start":
          this.startSnow();
          break;
        case "snow_end":
          this.endSnow();
          break;
      }
      if (IS_DEV) {
        const side = event.side ? ` side=${event.side}` : "";
        console.info(
          `[Hazard] ${event.type}${side} @ ${event.heightMeters}m (t=${Math.round(event.time)})`,
        );
      }
    }
  }

  // Computes and applies knockback from a projectile hit (never lethal). The
  // projectile keeps travelling; only the player's velocity is affected.
  private handleProjectileHit(payload: ProjectileHitPayload): void {
    const cfg = HAZARD_CONFIG.sideProjectile;

    // Horizontal direction: prefer the projectile's travel direction; fall back
    // to relative position when it's moving too slowly to be decisive.
    let dirX: number;
    if (Math.abs(payload.projectileVelocityX) > cfg.knockbackDirVelocityThreshold) {
      dirX = Math.sign(payload.projectileVelocityX);
    } else {
      dirX = Math.sign(payload.playerX - payload.projectileX);
      if (dirX === 0) dirX = payload.side === "left" ? 1 : -1;
    }

    const magnitudeX = Phaser.Math.Clamp(
      Math.abs(payload.projectileVelocityX) * cfg.knockbackXMultiplier,
      cfg.minKnockbackX,
      cfg.maxKnockbackX,
    );
    const velocityX = dirX * magnitudeX;
    const velocityY = Phaser.Math.Clamp(
      payload.projectileVelocityY * cfg.knockbackYMultiplier,
      -cfg.maxKnockbackY,
      cfg.maxKnockbackY,
    );

    this.player.applyKnockback({ velocityX, velocityY, controlLockMs: cfg.controlLockMs });
    // Visual-only impact feedback at the contact point (knockback is the gameplay).
    this.fx.playProjectileImpact(payload.projectileX, payload.projectileY);
  }

  // ── Snow Time helpers (shared by scheduler events and the dev toggle) ────────

  private startSnow(): void {
    this.snowController.startSnow({
      platforms: this.platformManager.getSnowEligiblePlatforms(),
    });
    this.hailstoneManager.start({
      snowParticleCount: this.snowController.getParticleCount(),
      isMobile: this.snowController.isMobileMode(),
    });
    this.player.setSnowModifier(true);
  }

  private endSnow(): void {
    this.snowController.endSnow();
    this.hailstoneManager.stopSpawning();
    this.player.setSnowModifier(false);
  }

  // Hailstone knockback (lighter than a projectile, never lethal). The stone
  // shatters on hit inside the manager; here we only shove the player.
  private handleHailstoneHit(payload: HailstoneHitPayload): void {
    const cfg = SNOW_CONFIG.hail;

    let dirX: number;
    if (Math.abs(payload.hailstoneVelocityX) > cfg.knockbackDirVelocityThreshold) {
      dirX = Math.sign(payload.hailstoneVelocityX);
    } else {
      dirX = Math.sign(payload.playerX - payload.hailstoneX);
      if (dirX === 0) dirX = Math.random() < 0.5 ? -1 : 1;
    }

    const magnitudeX = Phaser.Math.Clamp(
      Math.abs(payload.hailstoneVelocityX) * cfg.knockbackXMultiplier,
      cfg.minKnockbackX,
      cfg.maxKnockbackX,
    );
    const velocityX = dirX * magnitudeX;
    const velocityY = Phaser.Math.Clamp(
      payload.hailstoneVelocityY * cfg.knockbackYMultiplier,
      -cfg.maxKnockbackY,
      cfg.maxKnockbackY,
    );

    this.player.applyKnockback({ velocityX, velocityY, controlLockMs: cfg.controlLockMs });
  }

  // True when any movement/action input is active this frame — used to unlock
  // WebAudio on the first user gesture.
  private hasAnyInput(input: InputState): boolean {
    return (
      input.left ||
      input.right ||
      input.jumpPressed ||
      input.jumpHeld ||
      input.pausePressed ||
      input.restartPressed
    );
  }

  private triggerGameOver(): void {
    this.gameState = "gameOver";
    this.physics.pause();
    // Physics pause does not stop the WebAudio context or camera effects, so
    // the one-shot game-over cue + shake still play. Once per transition.
    this.sfx.playGameOver();
    this.fx.playGameOverShake();
    this.projectileManager.clear();
    this.hailstoneManager.clear();
    this.snowController.clear();
    this.player.setSnowModifier(false);
    // Defensive: an end-of-run state owns the screen — never leave the pause
    // modal underneath it (no animation, just gone).
    this.pauseOverlay.hideImmediate();
    this.hudController.setVisible(false);
    this.inputController.setMobileControlsVisible(false);
    // Build result params BEFORE handleRunFinished() persists the new best, so
    // isNewBest compares this run against the previously-saved record.
    this.gameOverController.show(this.buildResultParams());
    // Overlay is already up; persistence/score happen in the background.
    void this.handleRunFinished(null);
  }

  private triggerTowerComplete(): void {
    this.gameState = "towerComplete";
    this.physics.pause();
    // One-shot success arpeggio + ring pulse; once per transition. Tweens keep
    // running under physics pause, so the pulse animates behind the overlay text.
    this.sfx.playTowerComplete();
    this.fx.playTowerCompletePulse(this.player.getX(), this.player.getY());
    this.projectileManager.clear();
    this.hailstoneManager.clear();
    this.snowController.clear();
    this.player.setSnowModifier(false);
    this.pauseOverlay.hideImmediate();
    this.hudController.setVisible(false);
    this.inputController.setMobileControlsVisible(false);
    this.towerCompletionController.show(this.buildResultParams());
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
    // Host-initiated pause: silence any in-flight effect immediately.
    this.sfx.stopAll();
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

  // Shared result-card data for both end-of-run overlays. SCORE/HEIGHT are this
  // run's values; BEST is the persisted record (folded with this run); isNewBest
  // is true when this run's score beats the previously-saved best. Must be read
  // before handleRunFinished() writes the new best.
  private buildResultParams(): {
    score: number;
    heightMeters: number;
    bestHeightMeters: number;
    isNewBest: boolean;
  } {
    const snapshot = this.scoreController.getSnapshot();
    const save = SaveController.getInstance();
    const loaded = save.hasLoaded();
    const prevBestScore = loaded ? save.getSaveData().bestScore : 0;
    const prevBestHeight = loaded ? save.getSaveData().bestHeightMeters : 0;
    return {
      score: snapshot.score,
      heightMeters: snapshot.bestHeightMeters,
      bestHeightMeters: Math.max(prevBestHeight, snapshot.bestHeightMeters),
      isNewBest: snapshot.score > prevBestScore,
    };
  }

  private restartRun(): void {
    // Physics is paused in gameOver / towerComplete — resume before the scene
    // tears down so the fresh run starts with a running physics world.
    this.physics.resume();
    this.scene.restart();
  }

  private onShutdown(): void {
    this.hudController.destroy();
    this.pauseOverlay.destroy();
    this.inputController.destroy();
    this.gameOverController.destroy();
    this.towerCompletionController.destroy();
    // Detaches the host audio subscription and disposes this scene's audio graph
    // (the shared WebAudio context is left intact for the next scene).
    this.sfx.destroy();
    // Disposes any FX objects still mid-tween so nothing leaks across restart.
    this.fx.destroy();
    // Destroys live projectiles, warning markers and the physics group.
    this.projectileManager.destroy();
    // Destroys live hailstones and their physics group.
    this.hailstoneManager.destroy();
    // Destroys snow flakes and any remaining platform caps.
    this.snowController.destroy();

    // Detach platform pause/resume subscribers so the next GameScene instance
    // re-subscribes cleanly (the SDK callback itself stays registered once).
    this.unsubPlatformPause?.();
    this.unsubPlatformResume?.();
    this.unsubPlatformPause = null;
    this.unsubPlatformResume = null;
  }
}
