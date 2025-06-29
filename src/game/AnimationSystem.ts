import Phaser from 'phaser';
import { CubeCoords, cubeToPixel, getHexPoints } from '../utils/hexGrid';
import { resourceData, ResourceType } from '../data/gameData';
import { BuildingType } from "../data/buildingsData";

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  ease?: string;
  onComplete?: () => void;
  onStart?: () => void;
}

export interface ResourceDiscoveryConfig extends AnimationConfig {
  coords: CubeCoords;
  resourceType: ResourceType;
  amount: number;
}

export interface ConstructionCompletionConfig extends AnimationConfig {
  coords: CubeCoords;
  buildingType: BuildingType;
  level: number;
}

export interface FogRevealConfig extends AnimationConfig {
  coords: CubeCoords;
  revealRadius: number;
}

interface PooledGraphics extends Phaser.GameObjects.Graphics {
  isPooled?: boolean;
}

interface PooledText extends Phaser.GameObjects.Text {
  isPooled?: boolean;
}

export class GameAnimationSystem {
  private scene: Phaser.Scene;
  private hexSize: number;
  private graphicsPool: PooledGraphics[] = [];
  private textPool: PooledText[] = [];
  private activeAnimations: Set<Phaser.Tweens.Tween> = new Set();
  private particleEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private performanceMode: boolean = false;

  constructor(scene: Phaser.Scene, hexSize: number) {
    this.scene = scene;
    this.hexSize = hexSize;
    this.initializeParticleTextures();
    this.initializeObjectPools();
  }

  private initializeParticleTextures() {
    // Create glow texture for discovery effects
    const glowGraphics = this.scene.add.graphics();
    glowGraphics.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 1, 1, 0.5, 0);
    glowGraphics.fillCircle(16, 16, 16);
    glowGraphics.generateTexture('glow-particle', 32, 32);
    glowGraphics.destroy();

    // Create sparkle texture for construction completion
    const sparkleGraphics = this.scene.add.graphics();
    sparkleGraphics.fillStyle(0xffffff, 1);

    // Create a star shape using standard Phaser methods
    const starPoints = [];
    const outerRadius = 8;
    const innerRadius = 4;
    const totalPoints = 5;

    for (let i = 0; i < totalPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / totalPoints;
      starPoints.push({
        x: 8 + radius * Math.cos(angle - Math.PI / 2),
        y: 8 + radius * Math.sin(angle - Math.PI / 2)
      });
    }

    sparkleGraphics.beginPath();
    sparkleGraphics.moveTo(starPoints[0].x, starPoints[0].y);

    for (let i = 1; i < starPoints.length; i++) {
      sparkleGraphics.lineTo(starPoints[i].x, starPoints[i].y);
    }

    sparkleGraphics.closePath();
    sparkleGraphics.fillPath();
    sparkleGraphics.generateTexture('sparkle-particle', 16, 16);
    sparkleGraphics.destroy();

    // Create resource-specific particle textures
    Object.entries(resourceData).forEach(([resourceType, data]) => {
      const resourceGraphics = this.scene.add.graphics();
      const color = Phaser.Display.Color.HexStringToColor(data.color).color;
      resourceGraphics.fillStyle(color, 0.8);
      resourceGraphics.fillCircle(6, 6, 6);
      resourceGraphics.generateTexture(`${resourceType}-particle`, 12, 12);
      resourceGraphics.destroy();
    });

    // Create light ray texture
    const lightGraphics = this.scene.add.graphics();
    lightGraphics.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.8, 0.8, 0, 0);
    lightGraphics.fillRect(0, 0, 4, 40);
    lightGraphics.generateTexture('light-ray', 4, 40);
    lightGraphics.destroy();
  }

  private initializeObjectPools() {
    // Pre-create graphics objects for pooling
    // for (let i = 0; i < 10; i++) {
    //   const graphics = this.scene.add.graphics() as PooledGraphics;
    //   graphics.setActive(false);
    //   graphics.setVisible(false);
    //   graphics.isPooled = true;
    //   this.graphicsPool.push(graphics);
    // }

    // Pre-create text objects for pooling
    // for (let i = 0; i < 10; i++) {
    //   const text = this.scene.add.text(0, 0, '', {
    //     fontSize: '16px',
    //     color: '#ffffff'
    //   }) as PooledText;
    //   text.setActive(false);
    //   text.setVisible(false);
    //   text.isPooled = true;
    //   this.textPool.push(text);
    // }
  }

  private getPooledGraphics(): PooledGraphics {
    let graphics = this.graphicsPool.pop();

    if (!graphics) {
      graphics = this.scene.add.graphics() as PooledGraphics;
      graphics.isPooled = true;
    }

    graphics.setActive(true);
    graphics.setVisible(true);
    graphics.clear();

    // Force recreation of the graphics context
    if (graphics.displayList === null || graphics.displayList === undefined) {
      // If the display list is null, the graphics object needs to be re-added to the scene
      this.scene.add.existing(graphics);
    }

    return graphics;
  }

  private returnGraphicsToPool(graphics: PooledGraphics) {
    // if (graphics.isPooled) {
    //   graphics.setActive(false);
    //   graphics.setVisible(false);
    //   graphics.clear();
    //   this.graphicsPool.push(graphics);
    // } else {
    //   graphics.destroy();
    // }
    graphics.destroy();
  }

  private getPooledText(): PooledText {
    let text = this.textPool.pop();

    if (!text) {
      text = this.scene.add.text(0, 0, '', {
        fontSize: '16px',
        color: '#ffffff'
      }) as PooledText;
      text.isPooled = true;
    }

    text.setActive(true);
    text.setVisible(true);
    text.setText('');

    // Force recreation of the text context
    if (text.displayList === null || text.displayList === undefined) {
      // If the display list is null, the text object needs to be re-added to the scene
      this.scene.add.existing(text);
    }

    // Force Phaser to reinitialize the text object
    text.updateText();

    return text;
  }

  private returnTextToPool(text: PooledText) {
    // if (text.isPooled) {
    //   text.setActive(false);
    //   text.setVisible(false);
    //   text.setText('');
    //   this.textPool.push(text);
    // } else {
    //   text.destroy();
    // }
    text.destroy();
  }

  // 1. Resource Discovery Animation
  public createResourceDiscoveryAnimation(config: ResourceDiscoveryConfig): Promise<void> {
    return new Promise((resolve) => {
      const pixel = cubeToPixel(config.coords, this.hexSize);
      const resourceInfo = resourceData[config.resourceType];
      const color = Phaser.Display.Color.HexStringToColor(resourceInfo.color).color;

      // Phase 1: Initial glow effect (500ms)
      this.createGlowEffect(pixel, color, 500).then(() => {

        // Phase 2: Particle burst (800ms)
        this.createResourceParticleBurst(pixel, config.resourceType, 800).then(() => {

          // Phase 3: Resource counter increment (1000ms)
          this.createResourceCounterAnimation(config.resourceType, config.amount, 1000).then(() => {
            resolve();
          });
        });
      });
    });
  }

  private createGlowEffect(position: { x: number; y: number }, color: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      // Get pooled graphics object
      const glowRing = this.getPooledGraphics();
      glowRing.setPosition(position.x, position.y);

      // Animate glow expansion
      const tween = this.scene.tweens.add({
        targets: glowRing,
        duration: duration,
        ease: 'Power2',
        onUpdate: (tween) => {
          const progress = tween.progress;
          const radius = this.hexSize * (0.5 + progress * 1.5);
          const alpha = 0.8 * (1 - progress);

          glowRing.clear();
          glowRing.lineStyle(4, color, alpha);
          glowRing.strokeCircle(0, 0, radius);

          // Add inner glow
          glowRing.lineStyle(2, 0xffffff, alpha * 0.5);
          glowRing.strokeCircle(0, 0, radius * 0.8);
        },
        onComplete: () => {
          this.returnGraphicsToPool(glowRing);
          this.activeAnimations.delete(tween);
          resolve();
        }
      });

      this.activeAnimations.add(tween);
    });
  }

  private createResourceParticleBurst(position: { x: number; y: number }, resourceType: ResourceType, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const resourceInfo = resourceData[resourceType];
      const color = Phaser.Display.Color.HexStringToColor(resourceInfo.color).color;

      // Adjust particle count based on performance mode
      const particleCount = this.performanceMode ? 8 : 15;

      // Make sure the texture exists before creating the emitter
      const textureKey = `${resourceType}-particle`;
      if (!this.scene.textures.exists(textureKey)) {
        // console.warn(`createResourceParticleBurst > texture [${textureKey}] not found, creating fallback texture`);
        // Create a fallback texture if the specific one doesn't exist
        const fallbackGraphics = this.scene.add.graphics();
        fallbackGraphics.fillStyle(color, 0.8);
        fallbackGraphics.fillCircle(6, 6, 6);
        fallbackGraphics.generateTexture(textureKey, 12, 12);
        fallbackGraphics.destroy();
      }

      // Create particle emitter
      const emitter = this.scene.add.particles(position.x, position.y, textureKey, {
        speed: { min: 50, max: 150 },
        scale: { start: 1.2, end: 0.3 },
        alpha: { start: 1, end: 0 },
        tint: color,
        lifespan: duration * 0.8,
        quantity: particleCount,
        frequency: -1, // Burst mode
        emitZone: {
          type: 'edge',
          source: new Phaser.Geom.Circle(0, 0, this.hexSize * 0.3),
          quantity: particleCount
        },
        gravityY: 50,
        bounce: 0.3
      });

      // Add floating resource icon using pooled text
      const resourceIcon = this.getPooledText();
      // console.log(`createResourceParticleBurst [${resourceType}]`, resourceInfo, resourceIcon);
      resourceIcon.setText(resourceInfo.emoji);
      resourceIcon.setStyle({
        fontSize: '24px',
        align: 'center'
      });
      resourceIcon.setPosition(position.x, position.y);
      resourceIcon.setOrigin(0.5);
      resourceIcon.setDepth(1100);

      // Animate icon
      const iconTween = this.scene.tweens.add({
        targets: resourceIcon,
        y: position.y - 40,
        scale: { from: 1, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
          this.returnTextToPool(resourceIcon);
          emitter.destroy();
          this.activeAnimations.delete(iconTween);
          resolve();
        }
      });

      this.activeAnimations.add(iconTween);
    });
  }

  private createResourceCounterAnimation(resourceType: ResourceType, amount: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      // This would typically update the UI counter with a smooth increment
      // For now, we'll create a floating text effect
      const hudPosition = { x: 100, y: 50 }; // Approximate HUD position

      const floatingText = this.getPooledText();
      floatingText.setText(`+${amount}`);
      floatingText.setStyle({
        fontSize: '20px',
        color: resourceData[resourceType].color,
        fontStyle: 'bold'
      });
      floatingText.setPosition(hudPosition.x, hudPosition.y);
      floatingText.setOrigin(0.5);
      floatingText.setDepth(1200);

      const textTween = this.scene.tweens.add({
        targets: floatingText,
        y: hudPosition.y - 30,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 0.8 },
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
          this.returnTextToPool(floatingText);
          this.activeAnimations.delete(textTween);
          resolve();
        }
      });

      this.activeAnimations.add(textTween);
    });
  }

  // 2. Construction/Upgrade Completion Animation
  public createConstructionCompletionAnimation(config: ConstructionCompletionConfig): Promise<void> {
    return new Promise((resolve) => {
      const pixel = cubeToPixel(config.coords, this.hexSize);

      // Phase 1: Building outline pulse (300ms)
      this.createBuildingPulse(pixel, 300).then(() => {

        // Phase 2: Rising sparkle particles
        this.createRisingSparkles(pixel, 800).then(() => {

          // Phase 3: Structure scale bounce (400ms)
          this.createScaleBounce(pixel, 400).then(() => {

            // Display floating level text
            this.createFloatingLevelText(pixel, config.level, 600).then(() => {
              resolve();
            });
          });
        });
      });
    });
  }

  private createBuildingPulse(position: { x: number; y: number }, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const pulseOutline = this.getPooledGraphics();
      pulseOutline.setPosition(position.x, position.y);

      const pulseTween = this.scene.tweens.add({
        targets: pulseOutline,
        duration: duration,
        ease: 'Power2',
        yoyo: true,
        repeat: 1,
        onUpdate: (tween) => {
          const progress = tween.progress;
          const scale = 1 + progress * 0.3;
          const alpha = 0.8 * (1 - progress * 0.5);

          pulseOutline.clear();
          pulseOutline.lineStyle(3, 0x00ff00, alpha);

          // Draw hexagonal building outline
          const hexPoints = getHexPoints(0, 0, this.hexSize * scale);
          pulseOutline.beginPath();
          pulseOutline.moveTo(hexPoints[0].x, hexPoints[0].y);
          for (let i = 1; i < hexPoints.length; i++) {
            pulseOutline.lineTo(hexPoints[i].x, hexPoints[i].y);
          }
          pulseOutline.closePath();
          pulseOutline.strokePath();
        },
        onComplete: () => {
          this.returnGraphicsToPool(pulseOutline);
          this.activeAnimations.delete(pulseTween);
          resolve();
        }
      });

      this.activeAnimations.add(pulseTween);
    });
  }

  private createRisingSparkles(position: { x: number; y: number }, duration: number): Promise<void> {
    return new Promise((resolve) => {
      // Adjust particle count based on performance mode
      const particleCount = this.performanceMode ? 1 : 2;
      const frequency = this.performanceMode ? 100 : 50;

      const sparkleEmitter = this.scene.add.particles(position.x, position.y + this.hexSize * 0.5, 'sparkle-particle', {
        x: { min: -this.hexSize * 0.3, max: this.hexSize * 0.3 },
        y: 0,
        speedY: { min: -80, max: -40 },
        speedX: { min: -20, max: 20 },
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd700, 0xffffff, 0x00ff00],
        lifespan: duration,
        frequency: frequency,
        quantity: particleCount,
        gravityY: -20
      });

      this.scene.time.delayedCall(duration, () => {
        sparkleEmitter.destroy();
        resolve();
      });
    });
  }

  private createScaleBounce(position: { x: number; y: number }, duration: number): Promise<void> {
    return new Promise((resolve) => {
      // Find the building sprite at this position (simplified)
      const buildingSprite = this.scene.children.list.find(child =>
        'x' in child && 'y' in child &&
        // @ts-expect-error ignore
        (child as never).x === position.x &&
        // @ts-expect-error ignore
        (child as never).y === position.y &&
        child.type === 'Text'
      ) as Phaser.GameObjects.Text;

      if (buildingSprite) {
        const bounceTween = this.scene.tweens.add({
          targets: buildingSprite,
          scaleX: { from: 1, to: 1.1 },
          scaleY: { from: 1, to: 1.1 },
          duration: duration * 0.6,
          ease: 'Back.easeOut',
          yoyo: true,
          onComplete: () => {
            this.activeAnimations.delete(bounceTween);
            resolve();
          }
        });

        this.activeAnimations.add(bounceTween);
      } else {
        resolve();
      }
    });
  }

  private createFloatingLevelText(position: { x: number; y: number }, level: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const levelText = this.getPooledText();
      levelText.setText(`+Level ${level}`);
      levelText.setStyle({
        fontSize: '16px',
        color: '#00ff00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      });
      levelText.setPosition(position.x, position.y - 20);
      levelText.setOrigin(0.5);
      levelText.setDepth(1110);

      const textTween = this.scene.tweens.add({
        targets: levelText,
        y: position.y - 50,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 0.8 },
        duration: duration,
        ease: 'Power2',
        onComplete: () => {
          this.returnTextToPool(levelText);
          this.activeAnimations.delete(textTween);
          resolve();
        }
      });

      this.activeAnimations.add(textTween);
    });
  }

  // 3. Fog of War Transition Animation
  public createFogRevealAnimation(config: FogRevealConfig): Promise<void> {
    return new Promise((resolve) => {
      const pixel = cubeToPixel(config.coords, this.hexSize);

      // Create gradient-based fog dissolution
      this.createFogDissolution(pixel, config.revealRadius, 1000).then(() => {

        // Add light rays emanating from player position
        this.createLightRays(pixel, 800).then(() => {
          resolve();
        });
      });
    });
  }

  private createFogDissolution(position: { x: number; y: number }, radius: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      // Create fog overlay using pooled graphics
      const fogOverlay = this.getPooledGraphics();
      fogOverlay.setPosition(position.x, position.y);
      fogOverlay.setDepth(1305);

      const dissolveTween = this.scene.tweens.add({
        targets: fogOverlay,
        duration: duration,
        ease: 'Power2',
        onUpdate: (tween) => {
          const progress = tween.progress;
          const currentRadius = radius * this.hexSize * progress;

          fogOverlay.clear();

          // Create gradient effect with fewer rings in performance mode
          const ringCount = this.performanceMode ? 5 : 10;
          for (let i = 0; i < ringCount; i++) {
            const alpha = 0.6 * (1 - progress) * (1 - i / ringCount);
            const ringRadius = currentRadius + (i * 5);

            fogOverlay.lineStyle(3, 0x1a1a2e, alpha);
            fogOverlay.strokeCircle(0, 0, ringRadius);
          }
        },
        onComplete: () => {
          this.returnGraphicsToPool(fogOverlay);
          this.activeAnimations.delete(dissolveTween);
          resolve();
        }
      });

      this.activeAnimations.add(dissolveTween);
    });
  }

  private createLightRays(position: { x: number; y: number }, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const rayCount = this.performanceMode ? 4 : 8;
      const rays: Phaser.GameObjects.Image[] = [];

      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const ray = this.scene.add.image(position.x, position.y, 'light-ray');
        ray.setOrigin(0.5, 1);
        ray.setRotation(angle);
        ray.setAlpha(0);
        ray.setScale(0.5, 1);
        rays.push(ray);
      }

      // Animate rays
      const rayTween = this.scene.tweens.add({
        targets: rays,
        alpha: { from: 0, to: 0.6 },
        scaleY: { from: 1, to: 2 },
        duration: duration * 0.6,
        ease: 'Power2',
        yoyo: true,
        onComplete: () => {
          rays.forEach(ray => ray.destroy());
          this.activeAnimations.delete(rayTween);
          resolve();
        }
      });

      this.activeAnimations.add(rayTween);
    });
  }

  // Performance and cleanup methods
  public cancelAllAnimations(): void {
    this.activeAnimations.forEach(tween => {
      if (tween.isActive()) {
        tween.stop();
      }
    });
    this.activeAnimations.clear();

    this.particleEmitters.forEach(emitter => {
      if (emitter.active) {
        emitter.destroy();
      }
    });
    this.particleEmitters.clear();
  }

  public setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;

    if (enabled) {
      // Reduce animation complexity for mobile/low-end devices
      console.log('Animation system: Performance mode enabled');
    } else {
      console.log('Animation system: Full quality mode enabled');
    }
  }

  public getActiveAnimationCount(): number {
    return this.activeAnimations.size;
  }

  public getPoolStats(): { graphics: number; text: number } {
    return {
      graphics: this.graphicsPool.length,
      text: this.textPool.length
    };
  }

  public destroy(): void {
    this.cancelAllAnimations();

    // Destroy all pooled objects
    this.graphicsPool.forEach(graphics => graphics.destroy());
    this.graphicsPool = [];

    this.textPool.forEach(text => text.destroy());
    this.textPool = [];
  }
}
