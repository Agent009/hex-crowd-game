import { describe, expect, it } from 'vitest';
import { terrainData, TerrainType } from '../data/gameData';
import {
  terrainTextureSources,
  terrainSourceKey,
  terrainTileKey,
} from './terrainTextures';

// Guards the art→terrain mapping the tactical board bakes from. Every terrain
// the game can place on a tile must have at least one source variant, or those
// tiles fall back to flat colour with no atmospheric texture.
describe('terrain textures config', () => {
  it('provides at least one source variant for every terrain', () => {
    (Object.keys(terrainData) as TerrainType[]).forEach((terrain) => {
      const sources = terrainTextureSources[terrain];
      expect(sources, `missing textures for ${terrain}`).toBeTruthy();
      expect(sources.length).toBeGreaterThan(0);
      sources.forEach((url) => expect(typeof url).toBe('string'));
    });
  });

  it('generates unique loader/texture keys per terrain + variant', () => {
    const keys = new Set<string>();
    (Object.keys(terrainTextureSources) as TerrainType[]).forEach((terrain) => {
      terrainTextureSources[terrain].forEach((_url, variant) => {
        const src = terrainSourceKey(terrain, variant);
        const tile = terrainTileKey(terrain, variant);
        expect(src).not.toBe(tile);
        expect(keys.has(src)).toBe(false);
        expect(keys.has(tile)).toBe(false);
        keys.add(src);
        keys.add(tile);
      });
    });
  });
});
