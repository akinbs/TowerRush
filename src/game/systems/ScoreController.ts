import type { ScoreSnapshot } from "../types/gameTypes";
import { GROUND_SURFACE_Y, PIXELS_PER_METER, SCORE_PER_METER } from "../utils/constants";

export class ScoreController {
  private referenceY = GROUND_SURFACE_Y;
  private bestHeightMeters = 0;
  private lastPlayerY = GROUND_SURFACE_Y;

  // Call once when a run begins. Resets runtime state and sets the
  // ground-surface Y that serves as the height=0 reference.
  startRun(groundSurfaceY: number): void {
    this.referenceY = groundSurfaceY;
    this.lastPlayerY = groundSurfaceY;
    this.bestHeightMeters = 0;
  }

  // Call every frame while the game is running (not paused).
  update(playerY: number): void {
    this.lastPlayerY = playerY;
    const h = this.getCurrentHeightMeters();
    if (h > this.bestHeightMeters) {
      this.bestHeightMeters = h;
    }
  }

  // Current height based on the last known player position.
  getCurrentHeightMeters(): number {
    const px = Math.max(0, this.referenceY - this.lastPlayerY);
    return Math.floor(px / PIXELS_PER_METER);
  }

  // Highest height reached this run — never decreases.
  getBestRunHeightMeters(): number {
    return this.bestHeightMeters;
  }

  // Score is locked to the best height reached — going back down doesn't decrease it.
  getScore(): number {
    return this.bestHeightMeters * SCORE_PER_METER;
  }

  // Resets run state. Call when restarting.
  reset(): void {
    this.bestHeightMeters = 0;
    this.lastPlayerY = this.referenceY;
  }

  getSnapshot(): ScoreSnapshot {
    return {
      currentHeightMeters: this.getCurrentHeightMeters(),
      bestHeightMeters: this.bestHeightMeters,
      score: this.getScore(),
    };
  }
}
