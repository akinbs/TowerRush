// Minimal TypeScript surface for the YouTube Playables SDK global (`ytgame`).
// Only the members this game actually uses are declared. Optional members
// (engagement / health) mirror the SDK: they may be absent in some hosts, so
// every call site must guard with optional chaining.
export {};

declare global {
  interface YtGameScore {
    value: number;
  }

  interface YtGame {
    // True only inside the real YouTube Playables environment.
    IN_PLAYABLES_ENV?: boolean;

    game: {
      // Signal the first frame / splash can be shown. Call before gameReady().
      firstFrameReady(): void;
      // Signal the game is fully interactive. Call once, after firstFrameReady().
      gameReady(): void;
      // Cloud save: resolves with the previously saved string (or "" if none).
      loadData(): Promise<string>;
      // Cloud save: persists a string (≤ 3 MiB). Reject on failure.
      saveData(data: string): Promise<void>;
    };

    system: {
      isAudioEnabled(): boolean;
      onAudioEnabledChange(callback: (enabled: boolean) => void): void;
      onPause(callback: () => void): void;
      onResume(callback: () => void): void;
    };

    engagement?: {
      sendScore?(score: YtGameScore): Promise<void> | void;
    };

    health?: {
      logError?(message: string, error?: unknown): void;
      logWarning?(message: string): void;
    };
  }

  interface Window {
    ytgame?: YtGame;
  }
}
