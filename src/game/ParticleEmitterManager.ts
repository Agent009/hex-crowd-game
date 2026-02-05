import Phaser from "phaser";

/**
 * Configuration for creating a particle emitter
 */
export interface ParticleEmitterConfig {
  x: number;
  y: number;
  texture: string;
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  autoDestroy?: boolean;
  autoDestroyDelay?: number;
}

/**
 * Unified particle emitter manager for all particle effects.
 * Provides centralized lifecycle management, performance controls, and cleanup.
 */
export class ParticleEmitterManager {
  private emitters: Map<
    string,
    Phaser.GameObjects.Particles.ParticleEmitter
  > = new Map();
  private performanceMode: boolean = false;
  private scene: Phaser.Scene;
  private nextId: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a new particle emitter with automatic ID generation.
   * @param config - Emitter configuration
   * @returns Unique emitter ID
   */
  public createEmitter(config: ParticleEmitterConfig): string {
    const id = `emitter_${this.nextId++}`;
    return this.createEmitterWithId(id, config);
  }

  /**
   * Create a particle emitter with a specific ID.
   * @param id - Unique identifier for the emitter
   * @param config - Emitter configuration
   * @returns The provided emitter ID
   */
  public createEmitterWithId(
    id: string,
    config: ParticleEmitterConfig
  ): string {
    // Destroy existing emitter with same ID if it exists
    this.destroyEmitter(id);

    // Adjust particle count based on performance mode
    const adjustedConfig = this.adjustConfigForPerformance(config.config);

    const emitter = this.scene.add.particles(
      config.x,
      config.y,
      config.texture,
      adjustedConfig
    );

    this.emitters.set(id, emitter);

    // Auto-destroy if configured
    if (config.autoDestroy) {
      const delay = config.autoDestroyDelay ?? 1000;
      this.scene.time.delayedCall(delay, () => {
        this.destroyEmitter(id);
      });
    }

    return id;
  }

  /**
   * Get an emitter by ID.
   * @param id - Emitter ID
   * @returns The emitter or undefined if not found
   */
  public getEmitter(
    id: string
  ): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
    return this.emitters.get(id);
  }

  /**
   * Check if an emitter exists and is active.
   * @param id - Emitter ID
   * @returns True if emitter exists and is active
   */
  public isEmitterActive(id: string): boolean {
    const emitter = this.emitters.get(id);
    return emitter !== undefined && emitter.active;
  }

  /**
   * Destroy a specific emitter by ID.
   * @param id - Emitter ID
   */
  public destroyEmitter(id: string): void {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.destroy();
      this.emitters.delete(id);
    }
  }

  /**
   * Destroy all emitters.
   */
  public destroyAll(): void {
    this.emitters.forEach((emitter) => {
      emitter.destroy();
    });
    this.emitters.clear();
  }

  /**
   * Set performance mode, which reduces particle counts.
   * @param enabled - Whether performance mode is enabled
   */
  public setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
  }

  /**
   * Get current performance mode state.
   * @returns True if performance mode is enabled
   */
  public getPerformanceMode(): boolean {
    return this.performanceMode;
  }

  /**
   * Adjust particle emitter configuration based on performance mode.
   * @param config - Original configuration
   * @returns Adjusted configuration
   */
  private adjustConfigForPerformance(
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig
  ): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
    if (!this.performanceMode) {
      return config;
    }

    // Create a shallow copy to avoid mutating the original
    const adjusted: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig =
      { ...config };

    // Reduce particle quantities
    if (typeof adjusted.quantity === "number") {
      adjusted.quantity = Math.max(1, Math.floor(adjusted.quantity * 0.5));
    } else if (adjusted.quantity) {
      adjusted.quantity = {
        min: Math.max(1, Math.floor((adjusted.quantity.min ?? 1) * 0.5)),
        max: Math.max(1, Math.floor((adjusted.quantity.max ?? 1) * 0.5)),
      };
    }

    // Reduce frequency (spawn less often)
    if (typeof adjusted.frequency === "number" && adjusted.frequency > 0) {
      adjusted.frequency = adjusted.frequency * 2; // Double the interval
    }

    return adjusted;
  }

  /**
   * Update zoom level for all active emitters.
   * @param zoom - Current zoom level
   */
  public setZoomLevel(zoom: number): void {
    const scaleMultiplier = Math.max(0.5, Math.min(2, zoom));
    this.emitters.forEach((emitter) => {
      if (emitter && emitter.active) {
        emitter.setScale(scaleMultiplier);
      }
    });
  }

  /**
   * Get count of active emitters.
   * @returns Number of active emitters
   */
  public getActiveEmitterCount(): number {
    return Array.from(this.emitters.values()).filter(
      (emitter) => emitter.active
    ).length;
  }

  /**
   * Get all emitter IDs.
   * @returns Array of emitter IDs
   */
  public getEmitterIds(): readonly string[] {
    return Array.from(this.emitters.keys());
  }

  /**
   * Cleanup all resources.
   */
  public destroy(): void {
    this.destroyAll();
  }
}

