import Phaser from "phaser";
import { CubeCoords, cubeToPixel, getHexPoints } from "../utils/hexGrid";
import { GameConfig, PerformanceSettings } from "./GameConfig";
import { resourceData, ResourceType } from "../data/gameData";
import { TextureFactory, TextureKeys } from "./TextureFactory";
import { ParticleEmitterManager } from "./ParticleEmitterManager";

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

export interface CelebrationConfig extends AnimationConfig {
  coords: CubeCoords;
  text: string;
  color?: string;
}

export interface FogRevealConfig extends AnimationConfig {
  coords: CubeCoords;
  revealRadius: number;
}

export interface DisasterAnimationConfig extends AnimationConfig {
  disasterId: string;
  affectedTiles: CubeCoords[];
}

export class GameAnimationSystem implements PerformanceSettings {
  private scene: Phaser.Scene;
  private hexSize: number;
  private activeAnimations: Set<Phaser.Tweens.Tween> = new Set();
  private activeGameObjects: Set<Phaser.GameObjects.GameObject> = new Set();
  private particleEmitterManager: ParticleEmitterManager;
  private performanceMode: boolean = false;

  constructor(scene: Phaser.Scene, hexSize: number, sharedEmitterManager?: ParticleEmitterManager) {
    this.scene = scene;
    this.hexSize = hexSize;
    this.particleEmitterManager = sharedEmitterManager ?? new ParticleEmitterManager(scene);
  }

  private createGraphics(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    this.activeGameObjects.add(graphics);
    return graphics;
  }

  private destroyGraphics(graphics: Phaser.GameObjects.Graphics) {
    this.activeGameObjects.delete(graphics);
    graphics.destroy();
  }

  private createText(): Phaser.GameObjects.Text {
    const text = this.scene.add.text(0, 0, "", {
      fontSize: "16px",
      color: "#ffffff",
    });
    this.activeGameObjects.add(text);
    return text;
  }

  private destroyText(text: Phaser.GameObjects.Text) {
    this.activeGameObjects.delete(text);
    text.destroy();
  }

  // 1. Resource Discovery Animation
  public createResourceDiscoveryAnimation(
    config: ResourceDiscoveryConfig
  ): Promise<void> {
    return new Promise((resolve) => {
      const pixel = cubeToPixel(config.coords, this.hexSize);
      const resourceInfo = resourceData[config.resourceType];
      const color = Phaser.Display.Color.HexStringToColor(
        resourceInfo.color
      ).color;

      // Phase 1: Initial glow effect (500ms)
      this.createGlowEffect(pixel, color, 500).then(() => {
        // Phase 2: Particle burst (800ms)
        this.createResourceParticleBurst(pixel, config.resourceType, 800).then(
          () => {
            // Phase 3: Resource counter increment (1000ms)
            this.createResourceCounterAnimation(
              config.resourceType,
              config.amount,
              1000
            ).then(() => {
              resolve();
            });
          }
        );
      });
    });
  }

  private createGlowEffect(
    position: { x: number; y: number },
    color: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // Get pooled graphics object
      const glowRing = this.createGraphics();
      glowRing.setPosition(position.x, position.y);

      // Animate glow expansion
      const tween = this.scene.tweens.add({
        targets: glowRing,
        duration: duration,
        ease: "Power2",
        onUpdate: (tween: Phaser.Tweens.Tween) => {
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
          this.destroyGraphics(glowRing);
          this.activeAnimations.delete(tween);
          resolve();
        },
      });

      this.activeAnimations.add(tween);
    });
  }

  private createResourceParticleBurst(
    position: { x: number; y: number },
    resourceType: ResourceType,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const resourceInfo = resourceData[resourceType];
      const color = Phaser.Display.Color.HexStringToColor(
        resourceInfo.color
      ).color;

      const particleCount = this.performanceMode
        ? GameConfig.animation.particleCountLow
        : GameConfig.animation.particleCountHigh;

      // Get texture key from TextureFactory
      const textureKey = TextureFactory.getResourceParticleKey(resourceType);
      if (!this.scene.textures.exists(textureKey)) {
        console.warn(
          `createResourceParticleBurst > texture [${textureKey}] not found. Ensure TextureFactory.initialize() was called.`
        );
        resolve();
        return;
      }

      // Create particle emitter using manager
      const emitterId = this.particleEmitterManager.createEmitter({
        x: position.x,
        y: position.y,
        texture: textureKey,
        config: {
          speed: { min: 50, max: 150 },
          scale: { start: 1.2, end: 0.3 },
          alpha: { start: 1, end: 0 },
          tint: color,
          lifespan: duration * 0.8,
          quantity: particleCount,
          frequency: -1, // Burst mode
          emitZone: {
            type: "edge",
            source: new Phaser.Geom.Circle(0, 0, this.hexSize * 0.3),
            quantity: particleCount,
          },
          gravityY: 50,
          bounce: 0.3,
        },
        autoDestroy: true,
        autoDestroyDelay: duration * 0.8,
      });

      // Add floating resource icon using pooled text
      const resourceIcon = this.createText();
      resourceIcon.setText(resourceInfo.emoji);
      resourceIcon.setStyle({
        fontSize: "24px",
        align: "center",
      });
      resourceIcon.setPosition(position.x, position.y);
      resourceIcon.setOrigin(0.5);
      resourceIcon.setDepth(GameConfig.rendering.animationDepth);

      // Animate icon
      const iconTween = this.scene.tweens.add({
        targets: resourceIcon,
        y: position.y - 40,
        scale: { from: 1, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: duration,
        ease: "Power2",
        onComplete: () => {
          this.destroyText(resourceIcon);
          this.particleEmitterManager.destroyEmitter(emitterId);
          this.activeAnimations.delete(iconTween);
          resolve();
        },
      });

      this.activeAnimations.add(iconTween);
    });
  }

  private createResourceCounterAnimation(
    resourceType: ResourceType,
    amount: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // This would typically update the UI counter with a smooth increment
      // For now, we'll create a floating text effect
      const hudPosition = { x: GameConfig.animation.hudX, y: GameConfig.animation.hudY };

      const floatingText = this.createText();
      floatingText.setText(`+${amount}`);
      floatingText.setStyle({
        fontSize: "20px",
        color: resourceData[resourceType].color,
        fontStyle: "bold",
      });
      floatingText.setPosition(hudPosition.x, hudPosition.y);
      floatingText.setOrigin(0.5);
      floatingText.setDepth(GameConfig.rendering.hudTextDepth);

      const textTween = this.scene.tweens.add({
        targets: floatingText,
        y: hudPosition.y - 30,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 0.8 },
        duration: duration,
        ease: "Power2",
        onComplete: () => {
          this.destroyText(floatingText);
          this.activeAnimations.delete(textTween);
          resolve();
        },
      });

      this.activeAnimations.add(textTween);
    });
  }

  // 2. Celebration Animation (level-ups, combat victories, recruitment)
  public createCelebrationAnimation(config: CelebrationConfig): Promise<void> {
    return new Promise((resolve) => {
      const pixel = cubeToPixel(config.coords, this.hexSize);

      // Phase 1: Hex outline pulse (300ms)
      this.createHexPulse(pixel, 300).then(() => {
        // Phase 2: Rising sparkle particles
        this.createRisingSparkles(pixel, 800).then(() => {
          // Phase 3: Floating announcement text
          this.createFloatingText(
            pixel,
            config.text,
            600,
            config.color ?? "#00ff00"
          ).then(() => {
            resolve();
          });
        });
      });
    });
  }

  /**
   * Floating combat number (e.g. "-3" / "+2") rising from a tile and fading.
   * Used for board-level combat, spell, and healing feedback.
   */
  public createFloatingNumber(
    coords: CubeCoords,
    text: string,
    color: string = "#ffffff"
  ): void {
    const pixel = cubeToPixel(coords, this.hexSize);
    const jitterX = (((coords.q * 53 + coords.r * 17) % 11) - 5) * 2;

    const label = this.createText();
    label.setText(text);
    label.setStyle({
      fontSize: "20px",
      color,
      fontStyle: "bold",
      stroke: "#020617",
      strokeThickness: 4,
    });
    label.setPosition(pixel.x + jitterX, pixel.y - this.hexSize * 0.3);
    label.setOrigin(0.5);
    label.setDepth(GameConfig.rendering.animationDepth + 20);

    const tween = this.scene.tweens.add({
      targets: label,
      y: pixel.y - this.hexSize * 1.4,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.7, to: 1.25 },
      duration: 1100,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.destroyText(label);
        this.activeAnimations.delete(tween);
      },
    });
    this.activeAnimations.add(tween);
  }

  /**
   * A combat clash impact: an expanding shockwave ring plus a quick spark burst,
   * centred on the defending tile.
   */
  public createCombatClash(coords: CubeCoords): void {
    const pixel = cubeToPixel(coords, this.hexSize);

    // Expanding shockwave ring.
    const ring = this.createGraphics();
    ring.setPosition(pixel.x, pixel.y);
    ring.setDepth(GameConfig.rendering.animationDepth + 5);
    const ringTween = this.scene.tweens.add({
      targets: ring,
      duration: 520,
      ease: "Cubic.easeOut",
      onUpdate: (t: Phaser.Tweens.Tween) => {
        const p = t.progress;
        const radius = this.hexSize * (0.3 + p * 1.3);
        const alpha = 0.9 * (1 - p);
        ring.clear();
        ring.lineStyle(5, 0xfca5a5, alpha);
        ring.strokeCircle(0, 0, radius);
        ring.lineStyle(2, 0xffffff, alpha * 0.7);
        ring.strokeCircle(0, 0, radius * 0.7);
      },
      onComplete: () => {
        this.destroyGraphics(ring);
        this.activeAnimations.delete(ringTween);
      },
    });
    this.activeAnimations.add(ringTween);

    // Spark burst using the existing star particle texture.
    if (this.scene.textures.exists(TextureKeys.SPARKLE_STAR_PARTICLE)) {
      this.particleEmitterManager.createEmitter({
        x: pixel.x,
        y: pixel.y,
        texture: TextureKeys.SPARKLE_STAR_PARTICLE,
        config: {
          speed: { min: 80, max: 200 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xfca5a5, 0xfecaca, 0xffffff],
          lifespan: 450,
          quantity: this.performanceMode
            ? GameConfig.animation.particleCountLow
            : GameConfig.animation.particleCountHigh,
          frequency: -1,
          gravityY: 60,
        },
        autoDestroy: true,
        autoDestroyDelay: 500,
      });
    }
  }

  private createHexPulse(
    position: { x: number; y: number },
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const pulseOutline = this.createGraphics();
      pulseOutline.setPosition(position.x, position.y);

      const pulseTween = this.scene.tweens.add({
        targets: pulseOutline,
        duration: duration,
        ease: "Power2",
        yoyo: true,
        repeat: 1,
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const progress = tween.progress;
          const scale = 1 + progress * 0.3;
          const alpha = 0.8 * (1 - progress * 0.5);

          pulseOutline.clear();
          pulseOutline.lineStyle(3, 0x00ff00, alpha);

          const hexPoints = getHexPoints(0, 0, this.hexSize * scale);
          if (hexPoints.length === 0) return;
          pulseOutline.beginPath();
          pulseOutline.moveTo(hexPoints[0].x, hexPoints[0].y);
          for (let i = 1; i < hexPoints.length; i++) {
            pulseOutline.lineTo(hexPoints[i].x, hexPoints[i].y);
          }
          pulseOutline.closePath();
          pulseOutline.strokePath();
        },
        onComplete: () => {
          this.destroyGraphics(pulseOutline);
          this.activeAnimations.delete(pulseTween);
          resolve();
        },
      });

      this.activeAnimations.add(pulseTween);
    });
  }

  private createRisingSparkles(
    position: { x: number; y: number },
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const particleCount = this.performanceMode
        ? GameConfig.animation.sparkleQuantityLow
        : GameConfig.animation.sparkleQuantityHigh;
      const frequency = this.performanceMode
        ? GameConfig.animation.sparkleFrequencyLow
        : GameConfig.animation.sparkleFrequencyHigh;

      this.particleEmitterManager.createEmitter({
        x: position.x,
        y: position.y + this.hexSize * 0.5,
        texture: TextureKeys.SPARKLE_STAR_PARTICLE,
        config: {
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
          gravityY: -20,
        },
        autoDestroy: true,
        autoDestroyDelay: duration,
      });

      // Resolve immediately since manager handles cleanup
      resolve();
    });
  }

  private createFloatingText(
    position: { x: number; y: number },
    message: string,
    duration: number,
    color: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const floatText = this.createText();
      floatText.setText(message);
      floatText.setStyle({
        fontSize: "16px",
        color,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      });
      floatText.setPosition(position.x, position.y - 20);
      floatText.setOrigin(0.5);
      floatText.setDepth(GameConfig.rendering.animationDepth + 10);

      const textTween = this.scene.tweens.add({
        targets: floatText,
        y: position.y - 50,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 0.8 },
        duration: duration,
        ease: "Power2",
        onComplete: () => {
          this.destroyText(floatText);
          this.activeAnimations.delete(textTween);
          resolve();
        },
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

  private createFogDissolution(
    position: { x: number; y: number },
    radius: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // Create fog overlay using pooled graphics
      const fogOverlay = this.createGraphics();
      fogOverlay.setPosition(position.x, position.y);
      fogOverlay.setDepth(GameConfig.rendering.fogDepth);

      const dissolveTween = this.scene.tweens.add({
        targets: fogOverlay,
        duration: duration,
        ease: "Power2",
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const progress = tween.progress;
          const currentRadius = radius * this.hexSize * progress;

          fogOverlay.clear();

          const ringCount = this.performanceMode
            ? GameConfig.animation.ringCountLow
            : GameConfig.animation.ringCountHigh;
          for (let i = 0; i < ringCount; i++) {
            const alpha = 0.6 * (1 - progress) * (1 - i / ringCount);
            const ringRadius = currentRadius + i * 5;

            fogOverlay.lineStyle(3, 0x1a1a2e, alpha);
            fogOverlay.strokeCircle(0, 0, ringRadius);
          }
        },
        onComplete: () => {
          this.destroyGraphics(fogOverlay);
          this.activeAnimations.delete(dissolveTween);
          resolve();
        },
      });

      this.activeAnimations.add(dissolveTween);
    });
  }

  private createLightRays(
    position: { x: number; y: number },
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const rayCount = this.performanceMode
        ? GameConfig.animation.rayCountLow
        : GameConfig.animation.rayCountHigh;
      const rays: Phaser.GameObjects.Image[] = [];

      for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI * 2;
        const ray = this.scene.add.image(
          position.x,
          position.y,
          TextureKeys.LIGHT_RAY
        );
        ray.setOrigin(0.5, 1);
        ray.setRotation(angle);
        ray.setAlpha(0);
        ray.setScale(0.5, 1);
        rays.push(ray);
        this.activeGameObjects.add(ray);
      }

      const rayTween = this.scene.tweens.add({
        targets: rays,
        alpha: { from: 0, to: 0.6 },
        scaleY: { from: 1, to: 2 },
        duration: duration * 0.6,
        ease: "Power2",
        yoyo: true,
        onComplete: () => {
          rays.forEach((ray) => {
            this.activeGameObjects.delete(ray);
            ray.destroy();
          });
          this.activeAnimations.delete(rayTween);
          resolve();
        },
      });

      this.activeAnimations.add(rayTween);
    });
  }

  // Performance and cleanup methods
  public cancelAllAnimations(): void {
    this.activeAnimations.forEach((tween) => {
      if (tween.isActive()) {
        tween.stop();
      }
    });
    this.activeAnimations.clear();

    this.activeGameObjects.forEach((obj) => obj.destroy());
    this.activeGameObjects.clear();

    this.particleEmitterManager.destroyAll();
  }

  public setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
    this.particleEmitterManager.setPerformanceMode(enabled);
  }

  public getPerformanceMode(): boolean {
    return this.performanceMode;
  }

  public getActiveAnimationCount(): number {
    return this.activeAnimations.size;
  }

  public getActiveObjectCount(): number {
    return this.activeGameObjects.size;
  }

  // 4. Disaster Animation
  public createDisasterAnimation(
    config: DisasterAnimationConfig
  ): Promise<void> {
    return new Promise((resolve) => {
      const { disasterId, affectedTiles } = config;

      // Get texture key from TextureKeys
      const textureKeyMap: Readonly<Record<string, string>> = {
        earthquake: TextureKeys.EARTHQUAKE,
        sandstorm: TextureKeys.SANDSTORM,
        wildfire: TextureKeys.WILDFIRE,
        tsunami: TextureKeys.TSUNAMI,
        storm: TextureKeys.STORM,
      } as const;

      const textureKey: string | undefined = textureKeyMap[disasterId];
      if (!textureKey) {
        console.warn(`Unknown disaster ID: ${disasterId}`);
        resolve();
        return;
      }

      // Screen shake for earthquakes
      if (disasterId === "earthquake") {
        this.scene.cameras.main.shake(
          GameConfig.animation.earthquakeShakeDuration,
          GameConfig.animation.earthquakeShakeIntensity
        );
      }

      // Particle burst is heavier than the sprite/shake, so only emit on a
      // bounded number of tiles to keep large terrains from flooding the GPU.
      const maxEmitterTiles = this.performanceMode ? 4 : 10;

      // Create disaster sprites on affected tiles
      const animations: Promise<void>[] = affectedTiles.map((coords, index) => {
        return new Promise((tileResolve) => {
          const pixel = cubeToPixel(coords, this.hexSize);
          const sprite = this.scene.add.sprite(pixel.x, pixel.y, textureKey);
          sprite.setDepth(GameConfig.rendering.disasterDepth);
          sprite.setAlpha(0.8);
          this.activeGameObjects.add(sprite);

          if (index < maxEmitterTiles) {
            this.emitDisasterParticles(disasterId, pixel);
          }

          const tween = this.scene.tweens.add({
            targets: sprite,
            alpha: { from: 0.8, to: 0 },
            scale: { from: 1, to: 1.5 },
            duration: GameConfig.animation.disasterTweenDuration,
            ease: "Power2",
            onComplete: () => {
              this.activeGameObjects.delete(sprite);
              sprite.destroy();
              this.activeAnimations.delete(tween);
              tileResolve();
            },
          });

          this.activeAnimations.add(tween);
        });
      });

      // Wait for all animations to complete
      Promise.all(animations).then(() => {
        resolve();
      });
    });
  }

  /**
   * Spawn a short particle burst tuned to the disaster type at a tile centre.
   * Mirrors the combat-clash emitter so disasters read as physical events
   * (kicked-up dust, swirling sand, rising embers, spray, sparks) rather than
   * a silent sprite fade.
   */
  private emitDisasterParticles(
    disasterId: string,
    pixel: { x: number; y: number }
  ): void {
    const quantity = this.performanceMode
      ? GameConfig.animation.particleCountLow
      : GameConfig.animation.particleCountHigh;

    const presets: Readonly<
      Record<
        string,
        {
          texture: string;
          config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
          autoDestroyDelay: number;
        }
      >
    > = {
      earthquake: {
        texture: TextureKeys.DUST_PARTICLE,
        config: {
          speed: { min: 40, max: 140 },
          angle: { min: 200, max: 340 },
          scale: { start: 1.2, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: [0x8b4513, 0xa0522d, 0xd2b48c],
          lifespan: 750,
          quantity,
          frequency: -1,
          gravityY: 220,
        },
        autoDestroyDelay: 800,
      },
      sandstorm: {
        texture: TextureKeys.DUST_PARTICLE,
        config: {
          speedX: { min: 120, max: 260 },
          speedY: { min: -30, max: 30 },
          scale: { start: 1, end: 0.2 },
          alpha: { start: 0.7, end: 0 },
          tint: [0xdeb887, 0xd2b48c, 0xf5deb3],
          lifespan: 900,
          quantity,
          frequency: -1,
          gravityY: 0,
        },
        autoDestroyDelay: 950,
      },
      wildfire: {
        texture: TextureKeys.GLOW_PARTICLE,
        config: {
          speed: { min: 30, max: 90 },
          angle: { min: 240, max: 300 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xff4500, 0xff8c00, 0xffd700],
          lifespan: 800,
          quantity,
          frequency: -1,
          gravityY: -120,
        },
        autoDestroyDelay: 850,
      },
      tsunami: {
        texture: TextureKeys.SPARKLE_DOT_PARTICLE,
        config: {
          speed: { min: 60, max: 160 },
          angle: { min: 210, max: 330 },
          scale: { start: 1.4, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0x4682b4, 0x87ceeb, 0xffffff],
          lifespan: 700,
          quantity,
          frequency: -1,
          gravityY: 200,
        },
        autoDestroyDelay: 750,
      },
      storm: {
        texture: TextureKeys.SPARKLE_STAR_PARTICLE,
        config: {
          speed: { min: 90, max: 220 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0x483d8b, 0x9370db, 0xffffff],
          lifespan: 500,
          quantity,
          frequency: -1,
          gravityY: 40,
        },
        autoDestroyDelay: 550,
      },
    };

    const preset = presets[disasterId];
    if (!preset || !this.scene.textures.exists(preset.texture)) return;

    this.particleEmitterManager.createEmitter({
      x: pixel.x,
      y: pixel.y,
      texture: preset.texture,
      config: preset.config,
      autoDestroy: true,
      autoDestroyDelay: preset.autoDestroyDelay,
    });
  }

  public destroy(): void {
    this.cancelAllAnimations();
  }
}
