import {
  ANIM_PLAYER_FALL,
  ANIM_PLAYER_IDLE,
  ANIM_PLAYER_JUMP,
  ANIM_PLAYER_WALK,
  TEX_PLAYER,
} from "../utils/constants";

export interface AnimDef {
  key: string;
  textureKey: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

// Frame layout in TEX_PLAYER spritesheet:
// 0=idle  1-4=walk  5=jump  6=fall
export const PLAYER_ANIM_DEFS: AnimDef[] = [
  { key: ANIM_PLAYER_IDLE, textureKey: TEX_PLAYER, frames: [0],          frameRate: 1,  repeat: -1 },
  { key: ANIM_PLAYER_WALK, textureKey: TEX_PLAYER, frames: [1, 2, 3, 4], frameRate: 10, repeat: -1 },
  { key: ANIM_PLAYER_JUMP, textureKey: TEX_PLAYER, frames: [5],          frameRate: 1,  repeat:  0 },
  { key: ANIM_PLAYER_FALL, textureKey: TEX_PLAYER, frames: [6],          frameRate: 1,  repeat:  0 },
];
