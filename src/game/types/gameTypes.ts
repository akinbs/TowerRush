// ── Input ──────────────────────────────────────────────────────────────────

export interface InputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;    // true only on the frame the jump key was pressed
  jumpHeld: boolean;       // true while jump key is held (for variable jump height later)
  pausePressed: boolean;   // true only on the frame pause was triggered (keyboard or button)
  restartPressed: boolean; // true only on the frame restart was triggered (R key or button)
}

// ── Game State ──────────────────────────────────────────────────────────────

export type GameState = "playing" | "paused" | "gameOver";
export type DeathReason = "fall_distance" | "fall_velocity";

// ── Score ───────────────────────────────────────────────────────────────────

export interface ScoreSnapshot {
  currentHeightMeters: number;
  bestHeightMeters: number;
  score: number;
}

// ── Player ─────────────────────────────────────────────────────────────────

export type FacingDirection = "left" | "right";

export interface PlayerConfig {
  moveSpeed: number;
  jumpVelocity: number;
  // Reserved for future mechanics:
  // coyoteTime: number;
  // jumpBufferTime: number;
}

// ── Platform ───────────────────────────────────────────────────────────────

export type PlatformType = "normal" | "slippery" | "breakable" | "moving" | "goal";

export interface PlatformConfig {
  x: number;
  y: number;
  width: number;
  type: PlatformType;
}

// ── Tower / Phase ──────────────────────────────────────────────────────────

export interface TowerPhaseConfig {
  id: string;
  name: string;
  theme: string;
  height: number;
  gravity: number;
  playerMoveSpeed: number;
  playerJumpVelocity: number;
}

// ── Camera ─────────────────────────────────────────────────────────────────

export interface CameraConfig {
  // How far above the player the camera top boundary sits.
  // Future: camera only scrolls up (not back down easily).
  topMargin: number;
}

// ── Platform Generation ────────────────────────────────────────────────────

export interface PlatformGenerationConfig {
  /** How many platforms to create during initial scene setup. */
  initialPlatformCount: number;
  /** Generate platforms this many px above the current player Y. */
  generateAheadDistance: number;
  /** Destroy platforms this many px below the camera's bottom edge. */
  cleanupBelowDistance: number;
  minVerticalGap: number;
  maxVerticalGap: number;
  minPlatformWidth: number;
  maxPlatformWidth: number;
  /** Minimum px margin from world edges for platform placement. */
  safeHorizontalPadding: number;
  /** Max candidate attempts before using a fallback position. */
  maxGenerationAttempts: number;
  /** Scales theoretical max horizontal reach for reachability checks (0–1). */
  airControlMultiplier: number;
}
