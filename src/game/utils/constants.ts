// ── Canvas ─────────────────────────────────────────────────────────────────

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 700;

// ── Physics ────────────────────────────────────────────────────────────────

export const DEFAULT_GRAVITY = 800;

// ── Player ─────────────────────────────────────────────────────────────────

export const PLAYER_WIDTH = 32;
export const PLAYER_HEIGHT = 48;
export const PLAYER_MOVE_SPEED = 220;
export const PLAYER_JUMP_VELOCITY = -520;
export const PLAYER_FRICTION_FACTOR = 0.85;

// Coyote time: ms after leaving a platform during which a jump is still allowed.
export const COYOTE_TIME_MS = 100;

// Jump buffer: ms before landing during which a jump press is queued and fires on touch.
export const JUMP_BUFFER_MS = 120;

// ── Platform ───────────────────────────────────────────────────────────────

export const PLATFORM_HEIGHT = 16;
export const GROUND_HEIGHT = 24;

// ── Camera ─────────────────────────────────────────────────────────────────

export const CAMERA_TOP_MARGIN = 200;
// Lerp factors for delta-time scaled camera follow (1 - (1-base)^(delta/16.667)).
export const CAMERA_UP_LERP = 0.10;
export const CAMERA_DOWN_LERP = 0.28;
// px/s downward velocity above which the camera switches to fast follow mode.
export const CAMERA_FALL_VELOCITY_THRESHOLD = 250;

// ── Fall Death ─────────────────────────────────────────────────────────────

// Player must have climbed at least this many meters before fall death can trigger.
export const MIN_HEIGHT_FOR_FALL_DEATH_METERS = 5;
// Player dies when they fall this many meters below their best reached height.
export const FALL_DEATH_DISTANCE_METERS = 10;
// Warning UI triggers when fall distance reaches this many meters.
export const FALL_WARNING_DISTANCE_METERS = 6;

// ── World ──────────────────────────────────────────────────────────────────

export const WORLD_HEIGHT = 20000;

// ── Score / Height ─────────────────────────────────────────────────────────

export const PIXELS_PER_METER = 40;
export const SCORE_PER_METER = 10;
// Top surface of the ground — Y=0m reference for height calculations.
export const GROUND_SURFACE_Y = WORLD_HEIGHT - GROUND_HEIGHT;

// ── Scenes ─────────────────────────────────────────────────────────────────

export const SCENE_BOOT = "BootScene";
export const SCENE_PRELOAD = "PreloadScene";
export const SCENE_GAME = "GameScene";

// ── Texture keys ──────────────────────────────────────────────────────────

export const TEX_PLAYER = "player";
export const TEX_PLATFORM = "platform";
export const TEX_GROUND = "ground";
