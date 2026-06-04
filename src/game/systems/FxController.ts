import Phaser from "phaser";
import { FX_CONFIG } from "../config/fxConfig";
import { SNOW_CONFIG } from "../config/snowConfig";

// Shared shape for a rising-circle puff burst (jump / land / crack feedback).
interface CirclePuffParams {
  colors: number[];
  minRadius: number;
  maxRadius: number;
  alpha: number;
  spreadX: number;
  minRise: number;
  maxRise: number;
  minDurationMs: number;
  maxDurationMs: number;
}

// Lightweight, self-contained game-feel effects.
//
// Every effect is a handful of primitive GameObjects (Arc / Triangle) animated
// by a tween and destroyed on completion — no textures or particle assets.
// Live objects are tracked in a Set so a scene shutdown can dispose anything
// still mid-flight, preventing leaks across restarts.
export class FxController {
  private readonly scene: Phaser.Scene;
  private readonly activeObjects = new Set<Phaser.GameObjects.GameObject>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public FX ──────────────────────────────────────────────────────────────

  playJumpPuff(x: number, y: number): void {
    const c = FX_CONFIG.jumpPuff;
    this.burstCircles(x, y, c.count, c);
  }

  // intensity: downward impact speed (px/s). More particles for harder landings.
  playLandingPuff(x: number, y: number, intensity = 0): void {
    const c = FX_CONFIG.landPuff;
    const t = Phaser.Math.Clamp(intensity / c.intensityRefVelocity, 0, 1);
    const count = Math.round(Phaser.Math.Linear(c.minCount, c.maxCount, t));
    this.burstCircles(x, y, count, c);
  }

  playIceBreakParticles(x: number, y: number): void {
    const c = FX_CONFIG.iceBreak;
    const count = Phaser.Math.Between(c.minCount, c.maxCount);
    for (let i = 0; i < count; i++) {
      const size = Phaser.Math.Between(c.minSize, c.maxSize);
      const color = Phaser.Utils.Array.GetRandom(c.colors);
      const shard = this.scene.add
        .triangle(x, y, 0, size, size / 2, 0, size, size, color, c.alpha)
        .setDepth(FX_CONFIG.depth);
      this.track(shard);
      this.scene.tweens.add({
        targets: shard,
        x: x + Phaser.Math.Between(-c.spreadX, c.spreadX),
        y: y + Phaser.Math.Between(c.minFall, c.maxFall),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(c.minDurationMs, c.maxDurationMs),
        ease: "Quad.In",
        onComplete: () => this.release(shard),
      });
    }
  }

  // Tiny flecks at the moment a breakable starts cracking. Position is the
  // platform's world centre; the platform's own state machine is untouched.
  playCrackWarningPulse(x: number, y: number): void {
    const c = FX_CONFIG.crackPulse;
    this.burstCircles(x, y, c.count, c);
  }

  // Small spark puff where a projectile strikes the player (knockback is applied
  // separately by GameScene; this is purely visual, never lethal).
  playProjectileImpact(x: number, y: number): void {
    const c = FX_CONFIG.projectileImpact;
    this.burstCircles(x, y, c.count, c);
  }

  // Very small shake for a hard but survivable landing. Camera shake is a
  // transient matrix offset, so it never fights the scroll-based fall camera.
  playHardLandingShake(impactVelocityY = 0): void {
    const c = FX_CONFIG.shake.hardLanding;
    const t = Phaser.Math.Clamp(
      (impactVelocityY - FX_CONFIG.hardLandingVelocityY) /
        (FX_CONFIG.hardLandingMaxVelocityY - FX_CONFIG.hardLandingVelocityY),
      0,
      1,
    );
    const intensity = Phaser.Math.Linear(c.minIntensity, c.maxIntensity, t);
    this.scene.cameras.main.shake(c.durationMs, intensity);
  }

  playGameOverShake(): void {
    const c = FX_CONFIG.shake.gameOver;
    this.scene.cameras.main.shake(c.durationMs, c.intensity);
  }

  playTowerCompletePulse(x: number, y: number): void {
    const c = FX_CONFIG.towerCompletePulse;
    for (let i = 0; i < c.ringCount; i++) {
      // fillAlpha 0 → ring is stroke-only.
      const ring = this.scene.add
        .circle(x, y, c.startRadius, 0x000000, 0)
        .setStrokeStyle(c.lineWidth, c.color, 1)
        .setDepth(c.depth);
      this.track(ring);
      this.scene.tweens.add({
        targets: ring,
        scale: c.endScale,
        alpha: 0,
        delay: i * c.ringDelayMs,
        duration: c.durationMs,
        ease: "Cubic.Out",
        onComplete: () => this.release(ring),
      });
    }
  }

  // Small world-space ice shards when a hailstone shatters (one bounce / hit).
  playHailstoneShatter(x: number, y: number): void {
    const h = SNOW_CONFIG.hail;
    const count = Phaser.Math.Between(h.shatterParticleMin, h.shatterParticleMax);
    for (let i = 0; i < count; i++) {
      const radius = Phaser.Math.Between(h.shatterParticleRadiusMin, h.shatterParticleRadiusMax);
      const shard = this.scene.add
        .circle(x, y, radius, h.shatterColor, 0.95)
        .setDepth(h.depth);
      this.track(shard);
      this.scene.tweens.add({
        targets: shard,
        x: x + Phaser.Math.Between(-h.shatterSpreadX, h.shatterSpreadX),
        y: y + Phaser.Math.Between(-h.shatterRiseY, h.shatterFallY),
        alpha: 0,
        scale: 0.3,
        duration: h.shatterParticleLifetimeMs,
        ease: "Quad.Out",
        onComplete: () => this.release(shard),
      });
    }
  }

  // Disposes anything still animating (called on scene shutdown). Copy to an
  // array first since release() mutates the Set.
  destroy(): void {
    for (const obj of [...this.activeObjects]) {
      obj.destroy();
    }
    this.activeObjects.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private burstCircles(x: number, y: number, count: number, p: CirclePuffParams): void {
    for (let i = 0; i < count; i++) {
      const color = Phaser.Utils.Array.GetRandom(p.colors);
      const radius = Phaser.Math.Between(p.minRadius, p.maxRadius);
      const circle = this.scene.add
        .circle(x, y, radius, color, p.alpha)
        .setDepth(FX_CONFIG.depth);
      this.track(circle);
      this.scene.tweens.add({
        targets: circle,
        x: x + Phaser.Math.Between(-p.spreadX, p.spreadX),
        y: y - Phaser.Math.Between(p.minRise, p.maxRise),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(p.minDurationMs, p.maxDurationMs),
        ease: "Quad.Out",
        onComplete: () => this.release(circle),
      });
    }
  }

  private track(obj: Phaser.GameObjects.GameObject): void {
    this.activeObjects.add(obj);
  }

  // Idempotent: destroying an already-destroyed object is a safe no-op in Phaser.
  private release(obj: Phaser.GameObjects.GameObject): void {
    this.activeObjects.delete(obj);
    obj.destroy();
  }
}
