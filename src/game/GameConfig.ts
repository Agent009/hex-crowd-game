export interface PerformanceSettings {
  setPerformanceMode(enabled: boolean): void;
  getPerformanceMode(): boolean;
}

export const GameConfig = {
  camera: {
    keyboardSpeed: 5,
    minZoom: 0.5,
    maxZoom: 2,
    zoomInFactor: 1.1,
    zoomOutFactor: 0.9,
    backgroundColor: '#2D5016',
  },

  rendering: {
    tileDepthOffset: -1000,
    terrainIconDepth: 1000,
    playerNumberDepth: 1010,
    animationDepth: 1100,
    hudTextDepth: 1200,
    fogDepth: 1305,
    disasterDepth: 1500,
  },

  animation: {
    particleCountHigh: 15,
    particleCountLow: 8,
    ringCountHigh: 10,
    ringCountLow: 5,
    rayCountHigh: 8,
    rayCountLow: 4,
    sparkleFrequencyHigh: 50,
    sparkleFrequencyLow: 100,
    sparkleQuantityHigh: 2,
    sparkleQuantityLow: 1,
    hudX: 100,
    hudY: 50,
    disasterTweenDuration: 2000,
    earthquakeShakeDuration: 500,
    earthquakeShakeIntensity: 0.05,
  },

  canvas: {
    pollingIntervalMs: 100,
    maxPollAttempts: 50,
    resizeDebounceMs: 150,
    minHeight: 600,
  },
} as const;
