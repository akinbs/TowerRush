import Phaser from "phaser";
import type { Platform } from "../entities/Platform";
import { SNOW_CONFIG } from "../config/snowConfig";

type SnowState = "idle" | "active" | "fading";

// One persistent screen-space snowflake. Objects are created on snow_start and
// recycled (wrapped) for the whole event — never allocated per frame.
interface SnowParticle {
  obj: Phaser.GameObjects.Arc;
  baseX: number;     // drift/wrap position before sway is applied
  y: number;
  speedY: number;
  driftX: number;
  swayPhase: number;
  swayAmp: number;
  baseAlpha: number;
}

// Drives Snow Time: a screen-space flake field plus temporary platform snow
// caps. Built from primitive shapes only (no textures/assets). Lifecycle:
//   startSnow() → update(delta)… → endSnow() (fade) → idle
// destroy()/scene shutdown tears everything down immediately.
export class SnowController {
  private readonly scene: Phaser.Scene;

  private state: SnowState = "idle";
  private readonly particles: SnowParticle[] = [];
  private fadeElapsedMs = 0;

  // Every platform capped during the current snow event. Kept through the fade
  // so endSnow() can melt them all and a hard clear() can force-destroy them.
  // Replaced on each startSnow so it never accumulates across events.
  private snowCovered = new Set<Platform>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  isActive(): boolean {
    return this.state === "active";
  }

  // Device classification + flake count — shared with HailstoneManager so the
  // hail cap scales with the same particle budget.
  isMobileMode(): boolean {
    return this.scene.scale.width < SNOW_CONFIG.particle.mobileWidthThreshold;
  }

  getParticleCount(): number {
    const p = SNOW_CONFIG.particle;
    return this.isMobileMode() ? p.countMobile : p.countDesktop;
  }

  // Starts (or re-activates) a snowfall and caps ALL given platforms.
  startSnow(params: { platforms: Platform[] }): void {
    if (this.state === "active") return;

    // Re-activating from a fade keeps the existing flakes; only create when none.
    if (this.particles.length === 0) {
      this.createSnowParticles();
    }

    this.snowCovered = new Set<Platform>();
    this.state = "active";
    this.fadeElapsedMs = 0;
    this.coverPlatforms(params.platforms);
  }

  // While snow is active, ensures every eligible platform (including ones just
  // generated) carries a cap. No-op outside the active state, so platforms made
  // after snow_end stay clean.
  syncSnowCaps(platforms: Platform[]): void {
    if (this.state !== "active") return;
    this.coverPlatforms(platforms);
  }

  // Ends the snowfall: flakes fade over endFadeMs, caps melt over fadeOutMs.
  endSnow(): void {
    if (this.state !== "active") return;
    this.state = "fading";
    this.fadeElapsedMs = 0;
    for (const platform of this.snowCovered) {
      platform.removeSnowCap(SNOW_CONFIG.cap.fadeOutMs);
    }
  }

  update(delta: number): void {
    if (this.state === "idle") return;

    const p = SNOW_CONFIG.particle;
    const dt = delta / 1000;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    let globalAlpha = 1;
    if (this.state === "fading") {
      this.fadeElapsedMs += delta;
      globalAlpha = Phaser.Math.Clamp(1 - this.fadeElapsedMs / SNOW_CONFIG.endFadeMs, 0, 1);
    }

    for (const particle of this.particles) {
      particle.baseX += particle.driftX * dt;
      particle.y += particle.speedY * dt;
      particle.swayPhase += p.swaySpeed * delta;

      // Recycle off the bottom back to the top.
      if (particle.y > height + p.maxRadius) {
        particle.y = -p.maxRadius;
        particle.baseX = Phaser.Math.Between(0, width);
      }
      // Wrap horizontal drift so flakes never stream off forever.
      if (particle.baseX < -50) particle.baseX = width + 50;
      else if (particle.baseX > width + 50) particle.baseX = -50;

      particle.obj.setPosition(
        particle.baseX + Math.sin(particle.swayPhase) * particle.swayAmp,
        particle.y,
      );
      particle.obj.setAlpha(particle.baseAlpha * globalAlpha);
    }

    if (this.state === "fading" && globalAlpha <= 0) {
      this.destroySnowParticles();
      this.state = "idle";
      // Caps keep melting via their own Platform tweens; references stay in
      // snowCovered so a clear() inside the melt window can still force them.
    }
  }

  // Immediate teardown (game over / tower complete / restart). No fades.
  clear(): void {
    this.destroySnowParticles();
    for (const platform of this.snowCovered) {
      platform.destroySnowCap();
    }
    this.snowCovered.clear();
    this.state = "idle";
    this.fadeElapsedMs = 0;
  }

  destroy(): void {
    this.clear();
  }

  // ── Private: particles ─────────────────────────────────────────────────────

  private createSnowParticles(): void {
    const p = SNOW_CONFIG.particle;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const count = width < p.mobileWidthThreshold ? p.countMobile : p.countDesktop;

    for (let i = 0; i < count; i++) {
      const radius = Phaser.Math.Between(p.minRadius, p.maxRadius);
      const baseAlpha = Phaser.Math.FloatBetween(p.minAlpha, p.maxAlpha);
      const baseX = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);

      const obj = this.scene.add
        .circle(baseX, y, radius, 0xffffff, baseAlpha)
        .setScrollFactor(0)
        .setDepth(p.depth);

      // Smaller flakes fall faster for a parallax feel.
      const sizeT = (radius - p.minRadius) / Math.max(1, p.maxRadius - p.minRadius);
      const speedY = Phaser.Math.Linear(p.maxSpeedY, p.minSpeedY, sizeT);

      this.particles.push({
        obj,
        baseX,
        y,
        speedY,
        driftX: Phaser.Math.Between(p.minDriftX, p.maxDriftX),
        swayPhase: Phaser.Math.FloatBetween(0, Phaser.Math.PI2),
        swayAmp: Phaser.Math.FloatBetween(p.swayAmplitude * 0.4, p.swayAmplitude),
        baseAlpha,
      });
    }
  }

  private destroySnowParticles(): void {
    for (const particle of this.particles) {
      particle.obj.destroy();
    }
    this.particles.length = 0;
  }

  // ── Private: caps ──────────────────────────────────────────────────────────

  // Caps (or revives) each given platform and tracks it. addSnowCap is
  // idempotent, so calling this every frame while active is safe and cheap.
  private coverPlatforms(platforms: Platform[]): void {
    for (const platform of platforms) {
      platform.addSnowCap(this.scene);
      if (platform.hasSnowCap()) this.snowCovered.add(platform);
    }
  }
}
