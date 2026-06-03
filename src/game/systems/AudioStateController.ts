import { YouTubePlayablesBridge } from "../integrations/youtube/YouTubePlayablesBridge";

type AudioEnabledCallback = (enabled: boolean) => void;

// Holds the current YouTube audio-enabled state and keeps it in sync with the
// platform. Audio systems (SfxController) read isAudioEnabled() before playing
// and subscribe via onChange() so they can stop/mute the instant the host
// disables sound.
//
// Singleton: it registers the SDK audio-change subscription exactly once, so
// scene restarts never stack duplicate listeners.
export class AudioStateController {
  private static instance: AudioStateController | null = null;

  private enabled: boolean;

  // Fan-out subscribers (e.g. SfxController). Notified only on a real change.
  private readonly subscribers = new Set<AudioEnabledCallback>();

  private constructor() {
    const bridge = YouTubePlayablesBridge.getInstance();
    this.enabled = bridge.isAudioEnabled();
    // Never unsubscribed — this controller lives for the whole app lifetime.
    bridge.onAudioEnabledChange((enabled) => { this.handleHostChange(enabled); });
  }

  static getInstance(): AudioStateController {
    if (this.instance === null) {
      this.instance = new AudioStateController();
    }
    return this.instance;
  }

  isAudioEnabled(): boolean {
    return this.enabled;
  }

  // Subscribe to host audio-state changes. Returns an unsubscribe function;
  // using a Set keyed on the callback makes duplicate registration a no-op and
  // lets callers detach cleanly on scene shutdown.
  onChange(callback: AudioEnabledCallback): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  // ── Private ────────────────────────────────────────────────────────────

  private handleHostChange(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    for (const callback of this.subscribers) callback(enabled);
  }
}
