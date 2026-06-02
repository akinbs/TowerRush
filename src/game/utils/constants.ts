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
// Deceleration factor applied each frame when there is no horizontal input.
export const PLAYER_NORMAL_FRICTION_FACTOR = 0.85;
// ── Slippery surface movement ──────────────────────────────────────────────
// Max speed on slippery ground (multiplied against PLAYER_MOVE_SPEED).
// Higher than 1 so the surface feels fast, not sluggish.
export const PLAYER_SLIPPERY_SPEED_MULTIPLIER = 1.25;
// Lerp factor per frame when accelerating in the SAME direction already moving.
// Higher = snappier feel; 0.12 gives ~20 frames to reach full speed.
export const PLAYER_SLIPPERY_ACCEL_LERP = 0.12;
// Lerp factor per frame when pressing the OPPOSITE direction (turning around).
// Lower = harder to reverse; 0.04 gives ~30 frames to reach zero, then reverse.
export const PLAYER_SLIPPERY_TURN_LERP = 0.04;
// Decay applied each frame with no input — close to 1 means very slow stop.
export const PLAYER_SLIPPERY_FRICTION_FACTOR = 0.992;

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

// ── Fall Damage ────────────────────────────────────────────────────────────

// Minimum meters climbed before fall damage death can activate.
export const FALL_DAMAGE_MIN_HEIGHT_METERS = 5;
// Meters of free-fall from the airborne peak required to arm the danger state.
export const FALL_DAMAGE_DEATH_DISTANCE_METERS = 9;
// Meters of fall at which the warning state activates (below this = safe).
export const FALL_DAMAGE_WARNING_DISTANCE_METERS = 6;
// Minimum downward velocity (px/s) also required alongside distance to arm.
export const FALL_DAMAGE_MIN_VELOCITY_Y = 450;

// ── Regional Platform Render ───────────────────────────────────────────────

// px above the visible viewport top within which platforms stay active.
export const REGIONAL_RENDER_ABOVE_BUFFER_PX = 900;
// px below the visible viewport bottom within which platforms stay active.
export const REGIONAL_RENDER_BELOW_BUFFER_PX = 1100;

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

// ── Moving Platform ────────────────────────────────────────────────────────

// Horizontal oscillation speed range (px/s).
export const MOVING_PLATFORM_MIN_SPEED = 35;
export const MOVING_PLATFORM_MAX_SPEED = 85;

// Total oscillation distance range (px — centered on spawn position).
export const MOVING_PLATFORM_MIN_RANGE = 70;
export const MOVING_PLATFORM_MAX_RANGE = 170;

// ── Breakable Platform ─────────────────────────────────────────────────────

// Delay (ms) from first touch to the platform fully breaking.
export const BREAKABLE_BREAK_DELAY_MS = 1500;

// Alpha-flash interval (ms) during the cracking warning state.
export const BREAKABLE_WARNING_FLASH_INTERVAL_MS = 150;

// ── Player animation ───────────────────────────────────────────────────────

// Total frames in the player spritesheet:
// 0=idle, 1-4=walk cycle, 5=jump, 6=fall
export const PLAYER_FRAME_COUNT = 7;

export const ANIM_PLAYER_IDLE = "player-idle";
export const ANIM_PLAYER_WALK = "player-walk";
export const ANIM_PLAYER_JUMP = "player-jump";
export const ANIM_PLAYER_FALL = "player-fall";

// ── Texture keys ──────────────────────────────────────────────────────────

export const TEX_PLAYER = "player";
export const TEX_PLATFORM = "platform";
export const TEX_PLATFORM_SLIPPERY = "platform-slippery";
export const TEX_PLATFORM_BREAKABLE = "platform-breakable";
export const TEX_PLATFORM_MOVING = "platform-moving";
export const TEX_PLATFORM_GOAL = "platform-goal";
export const TEX_GROUND = "ground";
