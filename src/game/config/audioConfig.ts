// Self-contained procedural SFX parameters.
//
// No external audio assets, no network requests, no base64 blobs — every sound
// is synthesised at runtime on Phaser's shared WebAudio context (see
// SfxController). All numeric constants live here so the "magic number yasak"
// rule from CLAUDE.md holds for the audio layer too.

// A pitch-swept oscillator voice (jump / land / game over).
export interface SweepToneConfig {
  startFreq: number;
  endFreq: number;
  durationMs: number;
  volume: number;
  type: OscillatorType;
}

// A filtered-noise burst, optionally paired with a descending tone (crack / break).
export interface NoiseBurstConfig {
  durationMs: number;
  volume: number;
  filterHz: number;
  filterType: BiquadFilterType;
  // Optional pitch-falling tone layered under the noise (used by platformBreak).
  toneStartFreq?: number;
  toneEndFreq?: number;
  toneVolume?: number;
}

// A short success arpeggio (tower complete).
export interface ArpeggioConfig {
  notes: number[];
  noteDurationMs: number;
  volume: number;
  type: OscillatorType;
}

export interface AudioConfig {
  // Master gain applied to every SFX voice. Kept low so effects never clip or
  // dominate — these are subtle feedback cues, not music.
  masterVolume: number;

  jump: SweepToneConfig;
  land: SweepToneConfig;
  gameOver: SweepToneConfig;

  crack: NoiseBurstConfig;
  break: NoiseBurstConfig;

  towerComplete: ArpeggioConfig;

  // Per-effect minimum spacing (ms) between two plays — prevents spam when an
  // event fires on many consecutive frames.
  cooldowns: {
    jump: number;
    land: number;
    crack: number;
    break: number;
    gameOver: number;
    towerComplete: number;
  };

  // Land SFX only plays above this downward impact speed (px/s); a gentle step
  // onto a platform (or the tiny spawn settle) stays silent.
  landMinVelocityY: number;
  // Impact speed (px/s) at which the land SFX reaches full configured volume.
  landMaxVelocityY: number;
}

export const AUDIO_CONFIG: AudioConfig = {
  masterVolume: 0.28,

  // Short rising blip.
  jump: { startFreq: 180, endFreq: 420, durationMs: 120, volume: 0.5, type: "square" },
  // Short low thud; volume scales with impact speed in SfxController.
  land: { startFreq: 130, endFreq: 70, durationMs: 110, volume: 0.55, type: "triangle" },
  // Short falling tone.
  gameOver: { startFreq: 300, endFreq: 80, durationMs: 420, volume: 0.6, type: "sawtooth" },

  // Brief high-passed tick — the ice starting to crack.
  crack: {
    durationMs: 140, volume: 0.4, filterHz: 2600, filterType: "highpass",
  },
  // Slightly louder low-passed crunch with a descending tone — the slab giving way.
  break: {
    durationMs: 260, volume: 0.5, filterHz: 1500, filterType: "lowpass",
    toneStartFreq: 220, toneEndFreq: 70, toneVolume: 0.5,
  },

  // Three-note ascending arpeggio (≈C5–E5–G5), ~510 ms total.
  towerComplete: {
    notes: [523, 659, 784], noteDurationMs: 170, volume: 0.5, type: "triangle",
  },

  cooldowns: {
    jump: 50, land: 80, crack: 80, break: 120, gameOver: 200, towerComplete: 400,
  },

  landMinVelocityY: 180,
  landMaxVelocityY: 900,
};
