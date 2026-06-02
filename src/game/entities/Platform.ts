import Phaser from "phaser";
import type { PlatformConfig, PlatformType } from "../types/gameTypes";
import { PLATFORM_HEIGHT, TEX_PLATFORM } from "../utils/constants";

export class Platform {
  readonly gameObject: Phaser.Physics.Arcade.Image;
  readonly type: PlatformType;

  constructor(scene: Phaser.Scene, config: PlatformConfig) {
    this.type = config.type;

    const textureKey = this.resolveTexture(config.type);

    this.gameObject = scene.physics.add.staticImage(
      config.x,
      config.y,
      textureKey,
    );

    // Scale to the requested width while keeping the correct height.
    this.gameObject.setDisplaySize(config.width, PLATFORM_HEIGHT);

    // Sync the physics body to the new display size.
    (this.gameObject.body as Phaser.Physics.Arcade.StaticBody).setSize(
      config.width,
      PLATFORM_HEIGHT,
    );
    (this.gameObject.body as Phaser.Physics.Arcade.StaticBody).reset(
      config.x,
      config.y,
    );
  }

  // Resolves which texture key to use based on platform type.
  // Later types (slippery, moving, etc.) will have distinct textures/tints.
  private resolveTexture(type: PlatformType): string {
    switch (type) {
      case "normal":
      default:
        return TEX_PLATFORM;
    }
  }
}
