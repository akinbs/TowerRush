import { YouTubePlayablesBridge } from "./YouTubePlayablesBridge";

// Versioned, deliberately tiny save payload. Keep it small and forward
// compatible: unknown fields from newer versions are ignored on load, and a
// `version` field lets future migrations branch safely.
export interface GameSaveData {
  version: 1;
  bestScore: number;
  bestHeightMeters: number;
  completedTowers: string[];
}

const SAVE_VERSION = 1 as const;

// YouTube Playables hard limit on a save string is 3 MiB. This payload is a
// few dozen bytes, so the guard is purely defensive.
const MAX_SAVE_BYTES = 3 * 1024 * 1024;

function defaultSaveData(): GameSaveData {
  return {
    version: SAVE_VERSION,
    bestScore: 0,
    bestHeightMeters: 0,
    completedTowers: [],
  };
}

// Singleton so save state (and the "loaded" flag) persists across scene
// restarts — the cloud load happens once, not on every run.
export class SaveController {
  private static instance: SaveController | null = null;

  private readonly bridge = YouTubePlayablesBridge.getInstance();
  private data: GameSaveData = defaultSaveData();
  private loaded = false;
  // Guards against concurrent initialize() calls (e.g. fast restarts).
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SaveController {
    if (this.instance === null) {
      this.instance = new SaveController();
    }
    return this.instance;
  }

  // Loads cloud data exactly once. Safe to await repeatedly — later calls
  // resolve immediately. saveData() must never run before this resolves.
  initialize(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const raw = await this.bridge.loadSaveData();
      if (raw) {
        const parsed = this.safeParse(raw);
        if (parsed) this.data = parsed;
      }
      this.loaded = true;
    })();

    return this.initPromise;
  }

  hasLoaded(): boolean {
    return this.loaded;
  }

  getSaveData(): Readonly<GameSaveData> {
    return this.data;
  }

  // Updates best score/height. Returns true only when the *score* improved,
  // so callers can decide whether to submit a new high score.
  updateBest(score: number, heightMeters: number): boolean {
    let scoreImproved = false;
    if (score > this.data.bestScore) {
      this.data.bestScore = score;
      scoreImproved = true;
    }
    if (heightMeters > this.data.bestHeightMeters) {
      this.data.bestHeightMeters = heightMeters;
    }
    return scoreImproved;
  }

  markTowerCompleted(towerId: string): void {
    if (!this.data.completedTowers.includes(towerId)) {
      this.data.completedTowers.push(towerId);
    }
  }

  // Persists the current payload. No-ops (with a warning) before load completes
  // so we never clobber cloud data we haven't read yet.
  async save(): Promise<void> {
    if (!this.loaded) {
      this.bridge.logWarning("save() skipped — called before load completed");
      return;
    }

    const json = JSON.stringify(this.data);

    if (this.byteLength(json) > MAX_SAVE_BYTES) {
      this.bridge.logWarning("save() skipped — payload exceeds 3 MiB limit");
      return;
    }

    await this.bridge.saveData(json);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  // Defensive parse: invalid JSON or wrong field types fall back to defaults
  // rather than throwing. Unknown future fields are dropped.
  private safeParse(raw: string): GameSaveData | null {
    try {
      const obj = JSON.parse(raw) as Partial<GameSaveData> | null;
      if (obj === null || typeof obj !== "object") return null;

      const completed = Array.isArray(obj.completedTowers)
        ? obj.completedTowers.filter((t): t is string => typeof t === "string")
        : [];

      return {
        version: SAVE_VERSION,
        bestScore: typeof obj.bestScore === "number" ? obj.bestScore : 0,
        bestHeightMeters:
          typeof obj.bestHeightMeters === "number" ? obj.bestHeightMeters : 0,
        completedTowers: completed,
      };
    } catch (error) {
      this.bridge.logError("save data parse failed — using defaults", error);
      return null;
    }
  }

  private byteLength(str: string): number {
    return new TextEncoder().encode(str).length;
  }
}
