import {
  ANIM_DIR_LEFT,
  ANIM_DIR_RIGHT,
  ANIM_PLAYER_FALL,
  ANIM_PLAYER_HIT,
  ANIM_PLAYER_IDLE,
  ANIM_PLAYER_JUMP,
  ANIM_PLAYER_LAND,
  ANIM_PLAYER_WALK,
  ANIM_PLAYER_WIN,
  TEX_PLAYER,
  TEX_PLAYER_LEFT,
} from "../utils/constants";

// A base animation, direction-agnostic. The same frame indices exist in both
// the right- and left-facing sheets, so each base def is registered once per
// direction (see PLAYER_DIRECTIONS) onto its matching texture.
export interface AnimDef {
  key: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

// Frame layout shared by both sheets (icytower_spritesheet[_left].png):
// 0,1=idle  2-5=walk  6=jump  7=fall  8=land  9=hit  10,11=win
export const PLAYER_ANIM_DEFS: AnimDef[] = [
  { key: ANIM_PLAYER_IDLE, frames: [0, 1],       frameRate: 4,  repeat: -1 },
  { key: ANIM_PLAYER_WALK, frames: [2, 3, 4, 5], frameRate: 12, repeat: -1 },
  { key: ANIM_PLAYER_JUMP, frames: [6],          frameRate: 1,  repeat:  0 },
  { key: ANIM_PLAYER_FALL, frames: [7],          frameRate: 1,  repeat:  0 },
  // Optional / future-facing — registered so the keys resolve, not yet driven
  // by gameplay (land squash is a tween, hit/win are TowerComplete hooks).
  { key: ANIM_PLAYER_LAND, frames: [8],          frameRate: 1,  repeat:  0 },
  { key: ANIM_PLAYER_HIT,  frames: [9],          frameRate: 1,  repeat:  0 },
  { key: ANIM_PLAYER_WIN,  frames: [10, 11],     frameRate: 4,  repeat: -1 },
];

// One entry per facing: the runtime key suffix and the sheet it draws from.
// Phaser bakes the texture into each animation at creation time, so a separate
// animation instance is registered per direction.
export interface AnimDirection {
  suffix: string;
  textureKey: string;
}

export const PLAYER_DIRECTIONS: AnimDirection[] = [
  { suffix: ANIM_DIR_RIGHT, textureKey: TEX_PLAYER },
  { suffix: ANIM_DIR_LEFT,  textureKey: TEX_PLAYER_LEFT },
];
