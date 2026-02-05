import Phaser from "phaser";
import { CubeCoords, coordsToKey, cubeToPixel } from "../utils/hexGrid";
import { TerrainType } from "../data/gameData";
import { TextureKeys } from "./TextureFactory";
import { ParticleEmitterManager } from "./ParticleEmitterManager";

export interface ParticleConfig {
  x: number;
  y: number;
  texture?: string;
  tint?: number;
  alpha?: number;
  scale?: number;
  lifespan?: number;
  speed?: { min: number; max: number };
  gravity?: number;
}

export class AtmosphericParticleSystem {
  private scene: Phaser.Scene;
  private particleEmitterManager: ParticleEmitterManager;
  private fogParticleIds: Set<string> = new Set();
  private ambientParticleIds: Set<string> = new Set();
  private transitionEffectIds: Map<string, string> = new Map();
  private hexSize: number;
  private performanceMode: boolean = false;

  constructor(scene: Phaser.Scene, hexSize: number) {
    this.scene = scene;
    this.hexSize = hexSize;
    this.particleEmitterManager = new ParticleEmitterManager(scene);
    // Textures are now managed by TextureFactory, initialized in GameEngine
  }

  public createFogEffect(
    coords: CubeCoords,
    intensity: number = 1
  ): string | null {
    const pixel = cubeToPixel(coords, this.hexSize);
    const key = coordsToKey(coords);

    // Remove existing fog effect if any
    this.removeFogEffect(coords);

    const emitterId = this.particleEmitterManager.createEmitterWithId(
      `fog_${key}`,
      {
        x: pixel.x,
        y: pixel.y,
        texture: TextureKeys.FOG_PARTICLE,
        config: {
          x: {
            min: -this.hexSize * 0.3,
            max: this.hexSize * 0.3,
            ease: "Sine.InOut",
          },
          y: { min: -this.hexSize * 0.3, max: this.hexSize * 0.3 },
          scale: {
            start: 0.6 * intensity,
            end: 0.8 * intensity,
            ease: "Sine.InOut",
          },
          alpha: { start: 0.6 * intensity, end: 0 },
          tint: 0x708090, // Slate gray fog color
          lifespan: { min: 3000, max: 6000 },
          frequency: 500 / intensity, // Slower spawn rate
          quantity: 1, // Only one per interval
          speedX: { min: -5, max: 5 },
          speedY: { min: -2, max: -1 }, // very slow upward drift
          accelerationY: -2, // further enhance the float
          gravityY: -5,
          rotate: { min: -5, max: 5 },
          angle: { min: 0, max: 360 },
          blendMode: "MULTIPLY",
        },
      }
    );

    this.fogParticleIds.add(emitterId);
    return emitterId;
  }

  public removeFogEffect(coords: CubeCoords): void {
    const key = coordsToKey(coords);
    const emitterId = `fog_${key}`;
    if (this.fogParticleIds.has(emitterId)) {
      this.particleEmitterManager.destroyEmitter(emitterId);
      this.fogParticleIds.delete(emitterId);
    }
  }

  public createAmbientEffect(
    coords: CubeCoords,
    terrain: TerrainType
  ): string | null {
    const pixel = cubeToPixel(coords, this.hexSize);
    const key = coordsToKey(coords);
    let emitterId: string | null = null;

    switch (terrain) {
      case "forest":
        emitterId = this.particleEmitterManager.createEmitterWithId(
          `ambient_forest_${key}`,
          {
            x: pixel.x,
            y: pixel.y,
            texture: TextureKeys.LEAF_PARTICLE,
            config: {
              x: { min: -this.hexSize * 0.6, max: this.hexSize * 0.6 },
              y: { min: -this.hexSize * 0.6, max: this.hexSize * 0.6 },
              scale: { start: 0.8, end: 0.3 },
              alpha: { start: 0.7, end: 0 },
              tint: [0x228b22, 0x32cd32, 0x006400],
              lifespan: { min: 4000, max: 8000 },
              frequency: 1000,
              quantity: 1,
              speedX: { min: -20, max: 20 },
              speedY: { min: -10, max: 10 },
              gravityY: 15,
              rotate: { min: 0, max: 360 },
            },
          }
        );
        break;

      case "desert":
        emitterId = this.particleEmitterManager.createEmitterWithId(
          `ambient_desert_${key}`,
          {
            x: pixel.x,
            y: pixel.y,
            texture: TextureKeys.DUST_PARTICLE,
            config: {
              x: { min: -this.hexSize * 0.7, max: this.hexSize * 0.7 },
              y: { min: -this.hexSize * 0.7, max: this.hexSize * 0.7 },
              scale: { start: 0.5, end: 0.1 },
              alpha: { start: 0.4, end: 0 },
              tint: 0xdaa520,
              lifespan: { min: 2000, max: 4000 },
              frequency: 500,
              quantity: 2,
              speedX: { min: -30, max: 30 },
              speedY: { min: -20, max: -5 },
              gravityY: 5,
            },
          }
        );
        break;

      case "mountain":
        emitterId = this.particleEmitterManager.createEmitterWithId(
          `ambient_mountain_${key}`,
          {
            x: pixel.x,
            y: pixel.y,
            texture: TextureKeys.SPARKLE_DOT_PARTICLE,
            config: {
              x: { min: -this.hexSize * 0.5, max: this.hexSize * 0.5 },
              y: { min: -this.hexSize * 0.5, max: this.hexSize * 0.5 },
              scale: { start: 1, end: 0 },
              alpha: { start: 0.8, end: 0 },
              tint: [0xffd700, 0xc0c0c0, 0xffffff],
              lifespan: { min: 1000, max: 3000 },
              frequency: 2000,
              quantity: 1,
              speedX: { min: -5, max: 5 },
              speedY: { min: -10, max: -2 },
              gravityY: -2,
            },
          }
        );
        break;

      default:
        return null;
    }

    if (emitterId) {
      this.ambientParticleIds.add(emitterId);
    }
    return emitterId;
  }

  public createExplorationTransition(coords: CubeCoords): string {
    const pixel = cubeToPixel(coords, this.hexSize);
    const key = coordsToKey(coords);

    // Create simple expanding ring effect (legacy support)
    const emitterId = this.particleEmitterManager.createEmitterWithId(
      `transition_${key}`,
      {
        x: pixel.x,
        y: pixel.y,
        texture: TextureKeys.SPARKLE_DOT_PARTICLE,
        config: {
          x: 0,
          y: 0,
          scale: { start: 0.3, end: 0.8 },
          alpha: { start: 1, end: 0 },
          tint: 0x00ff00,
          lifespan: 1000,
          frequency: -1,
          quantity: 12,
          speedX: { min: -50, max: 50 },
          speedY: { min: -50, max: 50 },
          emitZone: {
            type: "edge",
            source: new Phaser.Geom.Circle(0, 0, this.hexSize * 0.8),
            quantity: 12,
          },
        },
        autoDestroy: true,
        autoDestroyDelay: 1000,
      }
    );

    this.transitionEffectIds.set(key, emitterId);
    return emitterId;
  }

  public createUnitMovementEffect(
    fromCoords: CubeCoords,
    toCoords: CubeCoords
  ): string {
    const fromPixel = cubeToPixel(fromCoords, this.hexSize);
    const toPixel = cubeToPixel(toCoords, this.hexSize);

    // Create trail effect
    const emitterId = this.particleEmitterManager.createEmitter({
      x: fromPixel.x,
      y: fromPixel.y,
      texture: TextureKeys.DUST_PARTICLE,
      config: {
        x: 0,
        y: 0,
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: 0x87ceeb,
        lifespan: 800,
        frequency: 50,
        quantity: 2,
        speedX: { min: -10, max: 10 },
        speedY: { min: -10, max: 10 },
      },
      autoDestroy: true,
      autoDestroyDelay: 1000,
    });

    // Animate emitter position
    const emitter = this.particleEmitterManager.getEmitter(emitterId);
    if (emitter) {
      this.scene.tweens.add({
        targets: emitter,
        x: toPixel.x,
        y: toPixel.y,
        duration: 1000,
        ease: "Power2",
      });
    }

    return emitterId;
  }

  public updateFogIntensity(coords: CubeCoords, fogLevel: number): void {
    if (fogLevel === 0) {
      // Dense fog
      this.createFogEffect(coords, 1.5);
    } else if (fogLevel === 1) {
      // Light fog
      this.createFogEffect(coords, 0.7);
    } else {
      // No fog
      this.removeFogEffect(coords);
    }
  }

  public setZoomLevel(zoom: number): void {
    // Delegate to particle emitter manager
    this.particleEmitterManager.setZoomLevel(zoom);
  }

  public setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
    this.particleEmitterManager.setPerformanceMode(enabled);
  }

  public getPerformanceMode(): boolean {
    return this.performanceMode;
  }

  public destroy(): void {
    // Destroy all emitters through manager
    this.particleEmitterManager.destroyAll();

    // Clear tracking sets
    this.fogParticleIds.clear();
    this.ambientParticleIds.clear();
    this.transitionEffectIds.clear();
  }
}
