import type { TowerPhaseConfig } from "../types/gameTypes";
import {
  DEFAULT_GRAVITY,
  PLAYER_JUMP_VELOCITY,
  PLAYER_MOVE_SPEED,
} from "../utils/constants";

// First (and currently only) tower phase — Ice Tower.
// Future phases will be appended to this array and selected by the phase system.
export const TOWER_PHASES: TowerPhaseConfig[] = [
  {
    id: "ice_tower",
    name: "Ice Tower",
    theme: "ice",
    height: 20000,
    gravity: DEFAULT_GRAVITY,
    playerMoveSpeed: PLAYER_MOVE_SPEED,
    playerJumpVelocity: PLAYER_JUMP_VELOCITY,
  },
];

export const INITIAL_PHASE = TOWER_PHASES[0];
