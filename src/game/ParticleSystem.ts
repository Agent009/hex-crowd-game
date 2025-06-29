import Phaser from 'phaser';
import { CubeCoords, coordsToKey, cubeToPixel } from '../utils/hexGrid';
import { TerrainType } from "../data/gameData";

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
  private fogParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private ambientParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private transitionEffects: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private hexSize: number;

  constructor(scene: Phaser.Scene, hexSize: number) {
    this.scene = scene;
    this.hexSize = hexSize;
    this.createParticleTextures();
  }

  private createParticleTextures() {
    // Create fog texture for fog of war transitions
    const fogGraphics = this.scene.add.graphics();
    fogGraphics.fillStyle(0xffffff, 0.05);

    // Draw layered circles to simulate a soft radial blur
    for (let r = 8; r > 0; r--) {
      fogGraphics.fillCircle(8, 8, r);
    }

    fogGraphics.generateTexture('fog-particle', 16, 16);
    fogGraphics.destroy();

    // Create dust particle texture
    const dustGraphics = this.scene.add.graphics();
    dustGraphics.fillStyle(0xd4af37, 0.6);
    dustGraphics.fillCircle(2, 2, 2);
    dustGraphics.generateTexture('dust-particle', 4, 4);
    dustGraphics.setDepth(1302);
    dustGraphics.destroy();

    // Create leaf particle texture
    const leafGraphics = this.scene.add.graphics();
    leafGraphics.fillStyle(0x228b22, 0.7);
    leafGraphics.fillEllipse(3, 2, 8, 6);
    leafGraphics.generateTexture('leaf-particle', 8, 6);
    leafGraphics.setDepth(1302);
    leafGraphics.destroy();

    // Create sparkle particle texture
    const sparkleGraphics = this.scene.add.graphics();
    sparkleGraphics.fillStyle(0xffd700, 1);
    sparkleGraphics.fillCircle(1, 1, 1);
    sparkleGraphics.generateTexture('sparkle-particle', 2, 2);
    sparkleGraphics.setDepth(1302);
    sparkleGraphics.destroy();
  }

  public createFogEffect(coords: CubeCoords, intensity: number = 1) {
    const pixel = cubeToPixel(coords, this.hexSize);

    // Remove existing fog effect if any
    this.removeFogEffect(coords);

    const emitter = this.scene.add.particles(pixel.x, pixel.y, 'fog-particle', {
      x: { min: -this.hexSize * 0.3, max: this.hexSize * 0.3, ease: 'Sine.InOut' },
      y: { min: -this.hexSize * 0.3, max: this.hexSize * 0.3 },
      scale: { start: 0.6 * intensity, end: 0.8 * intensity, ease: 'Sine.InOut' },
      alpha: { start: 0.6 * intensity, end: 0 },
      tint: 0x708090, // Slate gray fog color
      lifespan: { min: 3000, max: 6000 },
      frequency: 500 / intensity, // Slower spawn rate
      quantity: 1,                 // Only one per interval
      speedX: { min: -5, max: 5 },
      speedY: { min: -2, max: -1 }, // very slow upward drift
      accelerationY: -2,            // further enhance the float
      gravityY: -5,
      rotate: { min: -5, max: 5 },
      angle: { min: 0, max: 360 },

      blendMode: 'MULTIPLY', // Try 'NORMAL' or 'MULTIPLY' if too glowy, or 'ADD'
    });

    this.fogParticles.push(emitter);
    return emitter;
  }

  public removeFogEffect(coords: CubeCoords) {
    const key = coordsToKey(coords);
    const existingEffect = this.transitionEffects.get(key);
    if (existingEffect) {
      existingEffect.destroy();
      this.transitionEffects.delete(key);
    }
  }

  public createAmbientEffect(coords: CubeCoords, terrain: TerrainType) {
    const pixel = cubeToPixel(coords, this.hexSize);
    let emitter: Phaser.GameObjects.Particles.ParticleEmitter;

    switch (terrain) {
      case 'forest':
        emitter = this.scene.add.particles(pixel.x, pixel.y, 'leaf-particle', {
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
          rotate: { min: 0, max: 360 }
        });
        // console.log('Created ambient effect for forest terrain', pixel, coords, emitter);
        break;

      case 'desert':
        emitter = this.scene.add.particles(pixel.x, pixel.y, 'dust-particle', {
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
          gravityY: 5
        });
        break;

      case 'mountain':
        emitter = this.scene.add.particles(pixel.x, pixel.y, 'sparkle-particle', {
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
          gravityY: -2
        });
        break;

      default:
        return null;
    }

    this.ambientParticles.push(emitter);
    return emitter;
  }

  public createExplorationTransition(coords: CubeCoords) {
    const pixel = cubeToPixel(coords, this.hexSize);
    const key = coordsToKey(coords);

    // Create simple expanding ring effect (legacy support)
    const emitter = this.scene.add.particles(pixel.x, pixel.y, 'sparkle-particle', {
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
        type: 'edge',
        source: new Phaser.Geom.Circle(0, 0, this.hexSize * 0.8),
        quantity: 12
      }
    });

    // Auto-destroy after animation
    this.scene.time.delayedCall(1000, () => {
      emitter.destroy();
      this.transitionEffects.delete(key);
    });

    this.transitionEffects.set(key, emitter);
    return emitter;
  }

  public createUnitMovementEffect(fromCoords: CubeCoords, toCoords: CubeCoords) {
    const fromPixel = cubeToPixel(fromCoords, this.hexSize);
    const toPixel = cubeToPixel(toCoords, this.hexSize);

    // Create trail effect
    const emitter = this.scene.add.particles(fromPixel.x, fromPixel.y, 'dust-particle', {
      x: 0,
      y: 0,
      scale: { start: 0.3, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x87ceeb,
      lifespan: 800,
      frequency: 50,
      quantity: 2,
      speedX: { min: -10, max: 10 },
      speedY: { min: -10, max: 10 }
    });

    // Animate emitter position
    this.scene.tweens.add({
      targets: emitter,
      x: toPixel.x,
      y: toPixel.y,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        emitter.destroy();
      }
    });

    return emitter;
  }

  public updateFogIntensity(coords: CubeCoords, fogLevel: number) {
    // console.log("updateFogIntensity > coords", coords, "fogLevel", fogLevel);
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

  public setZoomLevel(zoom: number) {
    // Adjust particle scales based on zoom
    const scaleMultiplier = Math.max(0.5, Math.min(2, zoom));
    
    [...this.fogParticles, ...this.ambientParticles].forEach(emitter => {
      if (emitter && emitter.active) {
        emitter.setScale(scaleMultiplier);
      }
    });
  }

  public destroy() {
    [...this.fogParticles, ...this.ambientParticles].forEach(emitter => {
      if (emitter) emitter.destroy();
    });
    
    this.transitionEffects.forEach(emitter => {
      if (emitter) emitter.destroy();
    });

    this.fogParticles = [];
    this.ambientParticles = [];
    this.transitionEffects.clear();
  }
}
