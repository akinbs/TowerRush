import { YouTubePlayablesBridge } from "../integrations/youtube/YouTubePlayablesBridge";

// Holds the current YouTube audio-enabled state and keeps it in sync with the
// platform. There is no sound in the game yet — this is the bridge future
// audio systems will read so they can mute/unmute according to the host.
//
// Singleton: it registers the SDK audio-change subscription exactly once, so
// scene restarts never stack duplicate listeners.
export class AudioStateController {
  private static instance: AudioStateController | null = null;

  private enabled: boolean;

  private constructor() {
    const bridge = YouTubePlayablesBridge.getInstance();
    this.enabled = bridge.isAudioEnabled();
    // Never unsubscribed — this controller lives for the whole app lifetime.
    bridge.onAudioEnabledChange((enabled) => { this.enabled = enabled; });
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
}
