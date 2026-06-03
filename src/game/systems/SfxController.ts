import Phaser from "phaser";
import { AUDIO_CONFIG } from "../config/audioConfig";
import { AudioStateController } from "./AudioStateController";

// A single playing voice: one gain node fed by one or more scheduled sources.
// Tracked so stopAll() can silence everything mid-play (host mute / pause).
interface ActiveVoice {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
}

// Procedural, self-contained sound effects.
//
// Every effect is synthesised on Phaser's shared WebAudio AudioContext — no
// asset files, no base64, no network. Voices are routed through a private
// masterGain owned by this controller (NOT through Phaser sounds), so scene
// restarts can dispose this controller's audio graph without touching the
// shared context that Phaser keeps alive across restarts.
//
// Gating: a sound plays only when BOTH this.enabled and the live host state
// (AudioStateController.isAudioEnabled()) are true, the context is running, and
// the per-effect cooldown has elapsed.
export class SfxController {
  private readonly audioState: AudioStateController;
  private readonly context: AudioContext | null;
  private readonly masterGain: GainNode | null;

  private enabled: boolean;
  private readonly unsubAudioState: () => void;

  private readonly activeVoices = new Set<ActiveVoice>();
  private readonly lastPlayedAt = new Map<string, number>();
  private unlockRequested = false;

  constructor(scene: Phaser.Scene, audioState: AudioStateController) {
    this.audioState = audioState;
    this.enabled = audioState.isAudioEnabled();
    this.context = SfxController.resolveContext(scene);

    if (this.context) {
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = AUDIO_CONFIG.masterVolume;
      this.masterGain.connect(this.context.destination);
    } else {
      this.masterGain = null;
    }

    // Stop sound the instant the host disables audio; do nothing extra when it
    // re-enables (no auto-replay of old effects).
    this.unsubAudioState = audioState.onChange((enabled) => {
      this.enabled = enabled;
      if (!enabled) this.stopAll();
    });
  }

  // ── Unlock ───────────────────────────────────────────────────────────────

  // Browsers start the AudioContext suspended until a user gesture. Call this
  // on any real input; it no-ops once the context is running and only issues a
  // resume() while still suspended (so no per-frame promise churn).
  unlockOnce(): void {
    if (this.unlockRequested || !this.context) return;
    if (this.context.state !== "suspended") return;
    this.unlockRequested = true;
    // On failure, clear the guard so a later gesture can retry.
    this.context.resume().catch(() => { this.unlockRequested = false; });
  }

  // ── Enable / stop ──────────────────────────────────────────────────────────

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  // Quickly ramps every active voice to silence and stops its sources. Safe to
  // call repeatedly and when nothing is playing.
  stopAll(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.activeVoices) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
        voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        for (const source of voice.sources) {
          try { source.stop(now + 0.04); } catch { /* already stopped */ }
        }
      } catch { /* node disposed — ignore */ }
    }
    this.activeVoices.clear();
  }

  // ── Public SFX ─────────────────────────────────────────────────────────────

  playJump(): void {
    if (!this.canPlay("jump", AUDIO_CONFIG.cooldowns.jump)) return;
    const c = AUDIO_CONFIG.jump;
    this.playSweep(c.startFreq, c.endFreq, c.durationMs, c.volume, c.type);
  }

  // intensity: downward impact speed (px/s). Louder for harder landings.
  playLand(intensity = 0): void {
    if (!this.canPlay("land", AUDIO_CONFIG.cooldowns.land)) return;
    const c = AUDIO_CONFIG.land;
    const t = Phaser.Math.Clamp(
      (intensity - AUDIO_CONFIG.landMinVelocityY) /
        (AUDIO_CONFIG.landMaxVelocityY - AUDIO_CONFIG.landMinVelocityY),
      0,
      1,
    );
    const volume = c.volume * (0.5 + 0.5 * t);
    this.playSweep(c.startFreq, c.endFreq, c.durationMs, volume, c.type);
  }

  playCrackStart(): void {
    if (!this.canPlay("crack", AUDIO_CONFIG.cooldowns.crack)) return;
    this.playNoiseBurst(AUDIO_CONFIG.crack);
  }

  playPlatformBreak(): void {
    if (!this.canPlay("break", AUDIO_CONFIG.cooldowns.break)) return;
    this.playNoiseBurst(AUDIO_CONFIG.break);
  }

  playGameOver(): void {
    if (!this.canPlay("gameOver", AUDIO_CONFIG.cooldowns.gameOver)) return;
    const c = AUDIO_CONFIG.gameOver;
    this.playSweep(c.startFreq, c.endFreq, c.durationMs, c.volume, c.type);
  }

  playTowerComplete(): void {
    if (!this.canPlay("towerComplete", AUDIO_CONFIG.cooldowns.towerComplete)) return;
    const c = AUDIO_CONFIG.towerComplete;
    const ctx = this.context!;
    const master = this.masterGain!;
    const noteDur = c.noteDurationMs / 1000;
    let when = ctx.currentTime;
    for (const freq of c.notes) {
      const osc = ctx.createOscillator();
      osc.type = c.type;
      osc.frequency.setValueAtTime(freq, when);
      const gain = ctx.createGain();
      this.applyEnvelope(gain, when, noteDur, c.volume);
      osc.connect(gain);
      gain.connect(master);
      this.spawnVoice(gain, [osc], when, noteDur);
      when += noteDur;
    }
  }

  // ── Teardown ───────────────────────────────────────────────────────────────

  // Detaches the host subscription and disposes this controller's audio graph.
  // The shared AudioContext is intentionally NOT closed — Phaser owns it.
  destroy(): void {
    this.unsubAudioState();
    this.stopAll();
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch { /* already detached */ }
    }
    this.lastPlayedAt.clear();
  }

  // ── Private: gating ────────────────────────────────────────────────────────

  private canPlay(key: string, cooldownMs: number): boolean {
    // Respect both the cached flag and the live host state.
    if (!this.enabled || !this.audioState.isAudioEnabled()) return false;
    if (!this.context || !this.masterGain) return false;
    // Locked / suspended context → stay silent until unlock() succeeds.
    if (this.context.state !== "running") return false;

    const now = performance.now();
    const last = this.lastPlayedAt.get(key) ?? Number.NEGATIVE_INFINITY;
    if (now - last < cooldownMs) return false;
    this.lastPlayedAt.set(key, now);
    return true;
  }

  // ── Private: synthesis ─────────────────────────────────────────────────────

  private playSweep(
    startFreq: number,
    endFreq: number,
    durationMs: number,
    volume: number,
    type: OscillatorType,
  ): void {
    const ctx = this.context!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = durationMs / 1000;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + dur);

    const gain = ctx.createGain();
    this.applyEnvelope(gain, now, dur, volume);

    osc.connect(gain);
    gain.connect(master);
    this.spawnVoice(gain, [osc], now, dur);
  }

  private playNoiseBurst(cfg: {
    durationMs: number;
    volume: number;
    filterHz: number;
    filterType: BiquadFilterType;
    toneStartFreq?: number;
    toneEndFreq?: number;
    toneVolume?: number;
  }): void {
    const ctx = this.context!;
    const master = this.masterGain!;
    const now = ctx.currentTime;
    const dur = cfg.durationMs / 1000;

    // Shared per-voice gain shapes the whole burst and is the stopAll() handle.
    const voiceGain = ctx.createGain();
    this.applyEnvelope(voiceGain, now, dur, cfg.volume);
    voiceGain.connect(master);

    const sources: AudioScheduledSourceNode[] = [];

    // Filtered white-noise layer.
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = cfg.filterType;
    filter.frequency.value = cfg.filterHz;
    noise.connect(filter);
    filter.connect(voiceGain);
    sources.push(noise);

    // Optional descending tone layered under the noise (platformBreak).
    if (cfg.toneStartFreq !== undefined && cfg.toneEndFreq !== undefined) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(cfg.toneStartFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, cfg.toneEndFreq), now + dur);
      const oscGain = ctx.createGain();
      oscGain.gain.value = cfg.toneVolume ?? 0.5;
      osc.connect(oscGain);
      oscGain.connect(voiceGain);
      sources.push(osc);
    }

    this.spawnVoice(voiceGain, sources, now, dur);
  }

  // Short attack → exponential decay to (near) silence. Exponential ramps
  // cannot target 0, so 0.0001 stands in for silence.
  private applyEnvelope(gain: GainNode, startTime: number, dur: number, peak: number): void {
    const attack = Math.min(0.008, dur * 0.2);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  }

  private createNoiseBuffer(durSec: number): AudioBuffer {
    const ctx = this.context!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * durSec));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Starts and stops all sources, tracks the voice for stopAll(), and auto-
  // removes it from the active set once the last source finishes.
  private spawnVoice(
    voiceGain: GainNode,
    sources: AudioScheduledSourceNode[],
    startTime: number,
    dur: number,
  ): void {
    const stopTime = startTime + dur + 0.03;
    const voice: ActiveVoice = { gain: voiceGain, sources };
    this.activeVoices.add(voice);

    const last = sources[sources.length - 1];
    last.onended = () => { this.activeVoices.delete(voice); };

    for (const source of sources) {
      source.start(startTime);
      source.stop(stopTime);
    }
  }

  // ── Private: context resolution ─────────────────────────────────────────────

  private static resolveContext(scene: Phaser.Scene): AudioContext | null {
    const manager = scene.sound;
    // Only the WebAudio manager exposes a usable AudioContext. With NoAudio or
    // HTML5 managers we degrade to a silent no-op controller.
    if (manager instanceof Phaser.Sound.WebAudioSoundManager) {
      return manager.context;
    }
    return null;
  }
}
