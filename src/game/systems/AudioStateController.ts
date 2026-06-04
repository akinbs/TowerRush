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

  // Host (YouTube) audio permission. The user can only mute WITHIN this — when
  // the host disables audio, nothing the user does can re-enable it.
  private hostEnabled: boolean;
  // User-controlled mute (the menu/settings toggle).
  private userMuted = false;

  // Fan-out subscribers (e.g. SfxController). Notified only on a real change to
  // the EFFECTIVE state (hostEnabled && !userMuted).
  private readonly subscribers = new Set<AudioEnabledCallback>();

  private constructor() {
    const bridge = YouTubePlayablesBridge.getInstance();
    this.hostEnabled = bridge.isAudioEnabled();
    // Never unsubscribed — this controller lives for the whole app lifetime.
    bridge.onAudioEnabledChange((enabled) => { this.handleHostChange(enabled); });
  }

  static getInstance(): AudioStateController {
    if (this.instance === null) {
      this.instance = new AudioStateController();
    }
    return this.instance;
  }

  // Effective state — what the SFX layer must obey.
  isAudioEnabled(): boolean {
    return this.hostEnabled && !this.userMuted;
  }

  // Whether the host currently permits audio (gates the user toggle).
  isHostEnabled(): boolean {
    return this.hostEnabled;
  }

  isUserMuted(): boolean {
    return this.userMuted;
  }

  // User toggle. No-op against the host: muting always works, un-muting only
  // takes effect while the host permits audio.
  setUserMuted(muted: boolean): void {
    if (this.userMuted === muted) return;
    const prevEffective = this.isAudioEnabled();
    this.userMuted = muted;
    this.notifyIfChanged(prevEffective);
  }

  // Subscribe to EFFECTIVE audio-state changes. Returns an unsubscribe function;
  // a Set keyed on the callback makes duplicate registration a no-op and lets
  // callers detach cleanly on scene shutdown.
  onChange(callback: AudioEnabledCallback): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  // ── Private ────────────────────────────────────────────────────────────

  private handleHostChange(hostEnabled: boolean): void {
    if (this.hostEnabled === hostEnabled) return;
    const prevEffective = this.isAudioEnabled();
    this.hostEnabled = hostEnabled;
    this.notifyIfChanged(prevEffective);
  }

  private notifyIfChanged(prevEffective: boolean): void {
    const now = this.isAudioEnabled();
    if (now === prevEffective) return;
    for (const callback of this.subscribers) callback(now);
  }
}
