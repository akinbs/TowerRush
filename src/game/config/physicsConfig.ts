import Phaser from "phaser";
import { DEFAULT_GRAVITY } from "../utils/constants";

const IS_DEV = import.meta.env.DEV;

export const physicsConfig: Phaser.Types.Core.PhysicsConfig = {
  default: "arcade",
  arcade: {
    gravity: { x: 0, y: DEFAULT_GRAVITY },
    debug: IS_DEV, // flip to false for production automatically via build mode
  },
};
