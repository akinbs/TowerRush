import Phaser from "phaser";
import type { Player } from "../entities/Player";
import {
  CAMERA_DOWN_LERP,
  CAMERA_FALL_VELOCITY_THRESHOLD,
  CAMERA_TOP_MARGIN,
  CAMERA_UP_LERP,
  WORLD_HEIGHT,
} from "../utils/constants";

const FRAME_REF = 16.667; // ms — reference frame duration for lerp normalisation

export class CameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private currentScrollY: number;

  constructor(scene: Phaser.Scene) {
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, scene.scale.width, WORLD_HEIGHT);

    // Start at the bottom of the world where the player spawns.
    this.currentScrollY = WORLD_HEIGHT - scene.scale.height;
    this.camera.scrollY = this.currentScrollY;
  }

  update(player: Player, delta: number): void {
    const targetScrollY = player.getY() - CAMERA_TOP_MARGIN;

    // Use a faster lerp when the player is falling quickly so the death
    // zone stays visible; otherwise use the slow upward-follow lerp.
    const isFastFalling = player.getVelocityY() > CAMERA_FALL_VELOCITY_THRESHOLD;
    const baseLerp = isFastFalling ? CAMERA_DOWN_LERP : CAMERA_UP_LERP;

    // Delta-time normalised lerp: framerate-independent smoothing.
    const t = 1 - Math.pow(1 - baseLerp, delta / FRAME_REF);
    this.currentScrollY += (targetScrollY - this.currentScrollY) * t;

    this.camera.scrollY = this.clampScrollY(this.currentScrollY);
  }

  reset(sceneHeight: number): void {
    this.currentScrollY = WORLD_HEIGHT - sceneHeight;
    this.camera.scrollY = this.currentScrollY;
  }

  // ── Private ────────────────────────────────────────────────────────────

  private clampScrollY(y: number): number {
    const maxScroll = WORLD_HEIGHT - this.camera.height;
    return Math.max(0, Math.min(maxScroll, y));
  }
}
