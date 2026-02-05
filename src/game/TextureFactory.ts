import Phaser from "phaser";
import { resourceData, ResourceType } from "../data/gameData";

/**
 * Texture keys used throughout the game.
 * All texture keys must be unique to prevent conflicts.
 */
export const TextureKeys = {
  // Particle textures
  GLOW_PARTICLE: "glow-particle",
  SPARKLE_STAR_PARTICLE: "sparkle-star-particle", // 16x16 star shape for animations
  SPARKLE_DOT_PARTICLE: "sparkle-dot-particle", // 2x2 circle for particles
  LIGHT_RAY: "light-ray",
  FOG_PARTICLE: "fog-particle",
  DUST_PARTICLE: "dust-particle",
  LEAF_PARTICLE: "leaf-particle",
  // Resource particle textures (dynamically generated)
  RESOURCE_PARTICLE_PREFIX: "resource-particle-",
  // Disaster textures
  EARTHQUAKE: "earthquake",
  SANDSTORM: "sandstorm",
  WILDFIRE: "wildfire",
  TSUNAMI: "tsunami",
  STORM: "storm",
} as const;

export type TextureKey =
  | (typeof TextureKeys)[keyof typeof TextureKeys]
  | string;

/**
 * Configuration for creating a particle texture
 */
interface ParticleTextureConfig {
  key: string;
  width: number;
  height: number;
  generator: (graphics: Phaser.GameObjects.Graphics) => void;
}

/**
 * Centralized texture factory for all game textures.
 * Ensures textures are created only once and prevents naming conflicts.
 */
export class TextureFactory {
  private static initializedTextures: Set<string> = new Set();
  private static scene: Phaser.Scene | null = null;

  /**
   * Initialize all game textures. Must be called before any systems use textures.
   * @param scene - Phaser scene instance
   */
  public static initialize(scene: Phaser.Scene): void {
    if (this.scene && this.scene !== scene) {
      console.warn("TextureFactory: Scene changed, reinitializing textures");
      this.initializedTextures.clear();
    }
    this.scene = scene;

    this.createParticleTextures(scene);
    this.createDisasterTextures(scene);
    this.createResourceParticleTextures(scene);
  }

  /**
   * Ensure a texture exists, creating it if missing.
   * @param scene - Phaser scene instance
   * @param key - Texture key
   * @param generator - Function to generate the texture
   */
  public static ensureTextureExists(
    scene: Phaser.Scene,
    key: string,
    generator: (graphics: Phaser.GameObjects.Graphics) => void
  ): void {
    if (scene.textures.exists(key)) {
      return;
    }

    const graphics = scene.add.graphics();
    generator(graphics);
    graphics.generateTexture(key, 32, 32); // Default size, override in generator if needed
    graphics.destroy();
  }

  /**
   * Create all particle textures used by animation and particle systems.
   */
  private static createParticleTextures(scene: Phaser.Scene): void {
    const particleTextures: ParticleTextureConfig[] = [
      {
        key: TextureKeys.GLOW_PARTICLE,
        width: 32,
        height: 32,
        generator: (graphics) => {
          graphics.fillGradientStyle(
            0xffffff,
            0xffffff,
            0xffffff,
            0xffffff,
            1,
            1,
            0.5,
            0
          );
          graphics.fillCircle(16, 16, 16);
        },
      },
      {
        key: TextureKeys.SPARKLE_STAR_PARTICLE,
        width: 16,
        height: 16,
        generator: (graphics) => {
          graphics.fillStyle(0xffffff, 1);

          // Create a star shape
          const starPoints: Array<{ x: number; y: number }> = [];
          const outerRadius = 8;
          const innerRadius = 4;
          const totalPoints = 5;

          for (let i = 0; i < totalPoints * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / totalPoints;
            starPoints.push({
              x: 8 + radius * Math.cos(angle - Math.PI / 2),
              y: 8 + radius * Math.sin(angle - Math.PI / 2),
            });
          }

          graphics.beginPath();
          graphics.moveTo(starPoints[0]!.x, starPoints[0]!.y);

          for (let i = 1; i < starPoints.length; i++) {
            graphics.lineTo(starPoints[i]!.x, starPoints[i]!.y);
          }

          graphics.closePath();
          graphics.fillPath();
        },
      },
      {
        key: TextureKeys.SPARKLE_DOT_PARTICLE,
        width: 2,
        height: 2,
        generator: (graphics) => {
          graphics.fillStyle(0xffd700, 1);
          graphics.fillCircle(1, 1, 1);
        },
      },
      {
        key: TextureKeys.LIGHT_RAY,
        width: 4,
        height: 40,
        generator: (graphics) => {
          graphics.fillGradientStyle(
            0xffffff,
            0xffffff,
            0xffffff,
            0xffffff,
            0.8,
            0.8,
            0,
            0
          );
          graphics.fillRect(0, 0, 4, 40);
        },
      },
      {
        key: TextureKeys.FOG_PARTICLE,
        width: 16,
        height: 16,
        generator: (graphics) => {
          graphics.fillStyle(0xffffff, 0.05);

          // Draw layered circles to simulate a soft radial blur
          for (let r = 8; r > 0; r--) {
            graphics.fillCircle(8, 8, r);
          }
        },
      },
      {
        key: TextureKeys.DUST_PARTICLE,
        width: 4,
        height: 4,
        generator: (graphics) => {
          graphics.fillStyle(0xd4af37, 0.6);
          graphics.fillCircle(2, 2, 2);
        },
      },
      {
        key: TextureKeys.LEAF_PARTICLE,
        width: 8,
        height: 6,
        generator: (graphics) => {
          graphics.fillStyle(0x228b22, 0.7);
          graphics.fillEllipse(3, 2, 8, 6);
        },
      },
    ];

    particleTextures.forEach((config) => {
      if (scene.textures.exists(config.key)) {
        return; // Texture already exists, skip
      }

      const graphics = scene.add.graphics();
      config.generator(graphics);
      graphics.generateTexture(config.key, config.width, config.height);
      graphics.destroy();
      this.initializedTextures.add(config.key);
    });
  }

  /**
   * Create resource-specific particle textures for each resource type.
   */
  private static createResourceParticleTextures(scene: Phaser.Scene): void {
    Object.entries(resourceData).forEach(([resourceType, data]) => {
      const textureKey = `${TextureKeys.RESOURCE_PARTICLE_PREFIX}${resourceType}`;

      if (scene.textures.exists(textureKey)) {
        return; // Texture already exists, skip
      }

      const graphics = scene.add.graphics();
      const color = Phaser.Display.Color.HexStringToColor(data.color).color;
      graphics.fillStyle(color, 0.8);
      graphics.fillCircle(6, 6, 6);
      graphics.generateTexture(textureKey, 12, 12);
      graphics.destroy();
      this.initializedTextures.add(textureKey);
    });
  }

  /**
   * Create disaster effect textures.
   */
  private static createDisasterTextures(scene: Phaser.Scene): void {
    const disasterTextures: Array<{
      key: string;
      width: number;
      height: number;
      generator: (graphics: Phaser.GameObjects.Graphics) => void;
    }> = [
      {
        key: TextureKeys.EARTHQUAKE,
        width: 32,
        height: 32,
        generator: (graphics) => {
          graphics.fillStyle(0x8b4513, 0.8);
          graphics.fillRect(0, 0, 32, 32);
        },
      },
      {
        key: TextureKeys.SANDSTORM,
        width: 32,
        height: 32,
        generator: (graphics) => {
          graphics.fillStyle(0xdeb887, 0.6);
          graphics.fillCircle(16, 16, 16);
        },
      },
      {
        key: TextureKeys.WILDFIRE,
        width: 32,
        height: 32,
        generator: (graphics) => {
          graphics.fillStyle(0xff4500, 0.9);
          graphics.fillRect(0, 0, 32, 32);
        },
      },
      {
        key: TextureKeys.TSUNAMI,
        width: 32,
        height: 32,
        generator: (graphics) => {
          graphics.fillStyle(0x4682b4, 0.7);
          graphics.fillRect(0, 0, 32, 32);
        },
      },
      {
        key: TextureKeys.STORM,
        width: 32,
        height: 32,
        generator: (graphics) => {
          graphics.fillStyle(0x483d8b, 0.8);
          graphics.fillRect(0, 0, 32, 32);
        },
      },
    ];

    disasterTextures.forEach((config) => {
      if (scene.textures.exists(config.key)) {
        return; // Texture already exists, skip
      }

      const graphics = scene.add.graphics();
      config.generator(graphics);
      graphics.generateTexture(config.key, config.width, config.height);
      graphics.destroy();
      this.initializedTextures.add(config.key);
    });
  }

  /**
   * Get the texture key for a resource particle.
   * @param resourceType - Resource type
   * @returns Texture key for the resource particle
   */
  public static getResourceParticleKey(resourceType: ResourceType): string {
    return `${TextureKeys.RESOURCE_PARTICLE_PREFIX}${resourceType}`;
  }

  /**
   * Check if a texture has been initialized.
   * @param key - Texture key
   * @returns True if texture exists
   */
  public static isTextureInitialized(key: string): boolean {
    return this.initializedTextures.has(key);
  }

  /**
   * Get all initialized texture keys.
   * @returns Set of initialized texture keys
   */
  public static getInitializedTextures(): ReadonlySet<string> {
    return this.initializedTextures;
  }

  /**
   * Clear all initialized texture tracking (for testing/cleanup).
   */
  public static reset(): void {
    this.initializedTextures.clear();
    this.scene = null;
  }
}
