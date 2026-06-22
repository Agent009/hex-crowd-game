import { TerrainType } from "../data/gameData";

// Atmospheric isometric terrain art (DGW "Isometric Terrain 2" pack),
// downscaled into src/assets/terrain. Each entry lists the source variants for
// a terrain; the renderer bakes them into hex-masked tile textures at runtime
// and picks a variant per tile from a stable per-tile hash, so neighbouring
// tiles of the same terrain don't all look identical.
import plains1 from "../assets/terrain/plains1.png";
import plains2 from "../assets/terrain/plains2.png";
import forest1 from "../assets/terrain/forest1.png";
import forest2 from "../assets/terrain/forest2.png";
import mountain1 from "../assets/terrain/mountain1.png";
import mountain2 from "../assets/terrain/mountain2.png";
import desert1 from "../assets/terrain/desert1.png";
import desert2 from "../assets/terrain/desert2.png";
import lake1 from "../assets/terrain/lake1.png";
import lake2 from "../assets/terrain/lake2.png";
import river1 from "../assets/terrain/river1.png";
import river2 from "../assets/terrain/river2.png";

/** Source artwork URLs per terrain (Vite resolves these to hashed asset URLs). */
export const terrainTextureSources: Record<TerrainType, string[]> = {
  plains: [plains1, plains2],
  forest: [forest1, forest2],
  mountain: [mountain1, mountain2],
  desert: [desert1, desert2],
  lake: [lake1, lake2],
  river: [river1, river2],
};

/** Loader key for a raw (unmasked) terrain source image. */
export const terrainSourceKey = (terrain: TerrainType, variant: number): string =>
  `terrainSrc_${terrain}_${variant}`;

/** Texture key for the baked, hex-masked tile texture. */
export const terrainTileKey = (terrain: TerrainType, variant: number): string =>
  `terrainTile_${terrain}_${variant}`;

/**
 * How far to zoom into the centre of the source diamond when baking. The art
 * has transparent corners and (for mountains/forests) raised features near the
 * top; sampling the dense centre keeps the hex full and the ground readable.
 */
export const TERRAIN_SAMPLE_SCALE = 0.62;
