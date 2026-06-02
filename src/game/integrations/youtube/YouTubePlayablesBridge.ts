// Single point of contact between the game and the YouTube Playables SDK.
//
// Design goals:
//  • One instance for the whole app lifetime (survives scene restarts), so
//    firstFrameReady/gameReady fire at most once and SDK callbacks register
//    exactly once.
//  • Subscriber fan-out: the SDK pause/resume/audio callbacks are registered
//    once in the constructor and dispatched to a Set of subscribers. Callers
//    subscribe and receive an unsubscribe function, so scene restarts never
//    leak or double-register listeners.
//  • Dev fallback: when `window.ytgame` is absent (local dev, plain build) every
//    method degrades to a safe no-op. The game never crashes or spams console.

type VoidCallback = () => void;
type AudioCallback = (enabled: boolean) => void;

const IS_DEV = import.meta.env.DEV;

export class YouTubePlayablesBridge {
  private static instance: YouTubePlayablesBridge | null = null;

  // The SDK handle, or null when running outside the Playables environment.
  private readonly sdk: YtGame | null;

  private firstFrameReadyCalled = false;
  private gameReadyCalled = false;

  private readonly pauseSubscribers = new Set<VoidCallback>();
  private readonly resumeSubscribers = new Set<VoidCallback>();
  private readonly audioSubscribers = new Set<AudioCallback>();

  // Ensures the one-time "SDK not found" dev notice prints at most once.
  private devNoticeShown = false;

  private constructor() {
    this.sdk =
      typeof window !== "undefined" && window.ytgame ? window.ytgame : null;
    this.registerSdkCallbacks();
    if (!this.sdk) this.showDevNotice();
  }

  static getInstance(): YouTubePlayablesBridge {
    if (this.instance === null) {
      this.instance = new YouTubePlayablesBridge();
    }
    return this.instance;
  }

  // ── Environment queries ──────────────────────────────────────────────────

  isInPlayablesEnv(): boolean {
    return this.sdk?.IN_PLAYABLES_ENV === true;
  }

  isSdkAvailable(): boolean {
    return this.sdk !== null;
  }

  // ── Lifecycle signals (idempotent) ─────────────────────────────────────────

  markFirstFrameReady(): void {
    if (this.firstFrameReadyCalled) return;
    this.firstFrameReadyCalled = true;
    try {
      this.sdk?.game.firstFrameReady();
    } catch (error) {
      this.logError("firstFrameReady() failed", error);
    }
  }

  markGameReady(): void {
    if (this.gameReadyCalled) return;
    this.gameReadyCalled = true;
    try {
      this.sdk?.game.gameReady();
    } catch (error) {
      this.logError("gameReady() failed", error);
    }
  }

  // ── Pause / resume subscriptions ───────────────────────────────────────────

  // Returns an unsubscribe function. The SDK callback itself is registered only
  // once (in the constructor); these just add/remove fan-out subscribers.
  onPlatformPause(callback: VoidCallback): VoidCallback {
    this.pauseSubscribers.add(callback);
    return () => { this.pauseSubscribers.delete(callback); };
  }

  onPlatformResume(callback: VoidCallback): VoidCallback {
    this.resumeSubscribers.add(callback);
    return () => { this.resumeSubscribers.delete(callback); };
  }

  // ── Audio state ────────────────────────────────────────────────────────────

  isAudioEnabled(): boolean {
    try {
      return this.sdk?.system.isAudioEnabled() ?? true;
    } catch (error) {
      this.logError("isAudioEnabled() failed", error);
      return true;
    }
  }

  onAudioEnabledChange(callback: AudioCallback): VoidCallback {
    this.audioSubscribers.add(callback);
    return () => { this.audioSubscribers.delete(callback); };
  }

  // ── Cloud save ─────────────────────────────────────────────────────────────

  // Resolves with the saved string, or null when unavailable / on error.
  async loadSaveData(): Promise<string | null> {
    if (!this.sdk) return null;
    try {
      const data = await this.sdk.game.loadData();
      return data;
    } catch (error) {
      this.logError("loadData() failed", error);
      return null;
    }
  }

  // Returns true when the save was persisted, false on no-op / error.
  async saveData(data: string): Promise<boolean> {
    if (!this.sdk) return false;
    try {
      await this.sdk.game.saveData(data);
      return true;
    } catch (error) {
      this.logError("saveData() failed", error);
      return false;
    }
  }

  // ── Score submission ───────────────────────────────────────────────────────

  // Returns true when the score was accepted, false on no-op / error.
  async sendScore(score: number): Promise<boolean> {
    const submit = this.sdk?.engagement?.sendScore;
    if (!submit) return false;
    try {
      await submit({ value: score });
      return true;
    } catch (error) {
      this.logError("sendScore() failed", error);
      return false;
    }
  }

  // ── Health logging ──────────────────────────────────────────────────────────

  logWarning(message: string): void {
    try {
      this.sdk?.health?.logWarning?.(message);
    } catch {
      // Never let logging throw.
    }
    if (IS_DEV) console.warn(`[Playables] ${message}`);
  }

  logError(message: string, error?: unknown): void {
    try {
      this.sdk?.health?.logError?.(message, error);
    } catch {
      // Never let logging throw.
    }
    if (IS_DEV) console.error(`[Playables] ${message}`, error ?? "");
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private registerSdkCallbacks(): void {
    if (!this.sdk) return;
    try {
      this.sdk.system.onPause(() => {
        for (const cb of this.pauseSubscribers) cb();
      });
      this.sdk.system.onResume(() => {
        for (const cb of this.resumeSubscribers) cb();
      });
      this.sdk.system.onAudioEnabledChange((enabled) => {
        for (const cb of this.audioSubscribers) cb(enabled);
      });
    } catch (error) {
      this.logError("registering SDK callbacks failed", error);
    }
  }

  private showDevNotice(): void {
    if (!IS_DEV || this.devNoticeShown) return;
    this.devNoticeShown = true;
    console.info(
      "[Playables] ytgame SDK not found — running with local dev fallback (no-op).",
    );
  }
}
