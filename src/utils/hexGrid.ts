// Hexagonal grid utilities using cube coordinate system
import Phaser from "phaser";
import { TerrainType } from "../data/gameData";
import { Player } from "../data/gameData";

export interface CubeCoords {
  q: number;
  r: number;
  s: number;
}

export interface OffsetCoords {
  col: number;
  row: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HexTile {
  coords: CubeCoords;
  terrain: TerrainType;
  explored: boolean;
  visible: boolean;
  fogLevel: number; // 0 = unexplored, 1 = visible, 2 = explored
  players?: Player[]; // Players on this tile
  isActive?: boolean; // Can this tile be harvested from
}

export type GridSystem = "topDown" | "isometric" | "tactical";
export const DEFAULT_GRID_SYSTEM: GridSystem = "tactical";
export const gridSystem: GridSystem = import.meta.env.VITE_GRID_SYSTEM ? import.meta.env.VITE_GRID_SYSTEM as GridSystem : DEFAULT_GRID_SYSTEM;
export const isTopDownGrid = gridSystem === "topDown";
export const isIsometricGrid = gridSystem === "isometric";
export const isTacticalGrid = gridSystem === "tactical";

// Vertical foreshortening for the tilted "tactical" board — simulates a raised
// camera looking across the field instead of straight down. Applied uniformly
// to the Y axis of the top-down layout, which keeps the hexes perfectly
// tessellated (row pitch and hex height scale together) while reading as a
// receding 3D plane. Lower = steeper tilt; 1.0 = flat overhead.
export const TACTICAL_TILT_Y = 0.62;
// Env vars are always strings at runtime; `Number()` coerces it so arithmetic
// like `hexSize + 4` adds instead of string-concatenating (which produced a
// "324"px halo spanning the whole board).
export const DEFAULT_HEX_SIZE: number = import.meta.env.VITE_HEX_SIZE ? Number(import.meta.env.VITE_HEX_SIZE) : 32;

// Cube coordinate operations
export const cubeAdd = (a: CubeCoords, b: CubeCoords): CubeCoords => ({
  q: a.q + b.q,
  r: a.r + b.r,
  s: a.s + b.s,
});

export const cubeSubtract = (a: CubeCoords, b: CubeCoords): CubeCoords => ({
  q: a.q - b.q,
  r: a.r - b.r,
  s: a.s - b.s,
});

export const cubeDistance = (a: CubeCoords, b: CubeCoords): number =>
  Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));

// Hex directions (6 neighbors)
export const hexDirections: CubeCoords[] = [
  { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 }
];

export const getNeighbors = (coords: CubeCoords): CubeCoords[] =>
  hexDirections.map(dir => cubeAdd(coords, dir));

// Convert cube to offset coordinates
export const cubeToOffset = (cube: CubeCoords): OffsetCoords => ({
  col: cube.q + (cube.r - (cube.r & 1)) / 2,
  row: cube.r
});

// Convert offset to cube coordinates
export const offsetToCube = (offset: OffsetCoords): CubeCoords => {
  const q = offset.col - (offset.row - (offset.row & 1)) / 2;
  const r = offset.row;
  const s = -q - r;
  return { q, r, s };
};

// Convert cube coordinates to pixel position
export const cubeToPixel = (coords: CubeCoords, size: number): Point => {
  // 1. Flat-top hex -> Cartesian (flat) pixel
  // axial coords { q, r }
  const flatWidth  = Math.sqrt(3) * size;             // distance between left/right corners
  const flatHeight = size * 2;                        // top/bottom corners

  // point in **flat** 2D space:
  const flatX = flatWidth  * (coords.q + coords.r/2);
  const flatY = (flatHeight * 3/4) * coords.r;        // 3/4 because each row overlaps the next by 1/4 height

  if (isTopDownGrid) {
    return { x: flatX, y: flatY };
  }

  if (isTacticalGrid) {
    // Tilt the flat board away from the camera: squash Y only. Uniform scaling
    // preserves the tessellation, so neighbours stay edge-to-edge.
    return { x: flatX, y: flatY * TACTICAL_TILT_Y };
  }

  // 2. 2D flat -> isometric projection
  // Turn that 2D grid into true-iso:
  const isoX = flatX - flatY;
  const isoY = (flatX + flatY) * 0.5;

  return { x: isoX, y: isoY };
};

// Convert pixel position to cube coordinates
export const pixelToCube = (point: Point, size: number): CubeCoords => {
  if (isTopDownGrid || isTacticalGrid) {
    // Reverse the tactical tilt before the flat inverse transform.
    const py = isTacticalGrid ? point.y / TACTICAL_TILT_Y : point.y;
    const q = (Math.sqrt(3)/3 * point.x - 1/3 * py) / size;
    const r = (2/3 * py) / size;
    return cubeRound({ q, r, s: -q - r });
  }

  // Reverse the isometric transformation
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = size * 1.5;

  // Reverse isometric projection
  const flatX = (point.x / Math.cos(Math.PI / 6) + point.y / Math.sin(Math.PI / 6)) * 0.5;
  const flatY = (point.y / Math.sin(Math.PI / 6) - point.x / Math.cos(Math.PI / 6)) * 0.5;

  // Convert back to cube coordinates
  const r = flatY / hexHeight;
  const q = (flatX / hexWidth) - (r * 0.5);

  return cubeRound({ q, r, s: -q - r });
};

// Round fractional cube coordinates to nearest integer coordinates
export const cubeRound = (coords: CubeCoords): CubeCoords => {
  let q = Math.round(coords.q);
  let r = Math.round(coords.r);
  let s = Math.round(coords.s);

  const qDiff = Math.abs(q - coords.q);
  const rDiff = Math.abs(r - coords.r);
  const sDiff = Math.abs(s - coords.s);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
};

export const getHexPoints = (x: number, y: number, size: number): Phaser.Types.Math.Vector2Like[] => {
  if (isIsometricGrid) {
    return getIsometricHexPoints(x, y, size);
  }

  // Top-down (tilt = 1) and tactical (tilt = TACTICAL_TILT_Y) share the same
  // pointy-top outline; tactical just squashes it vertically to match the
  // foreshortened board.
  const tilt = isTacticalGrid ? TACTICAL_TILT_Y : 1;
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6; // Pointy-top orientation
    points.push({
      x: x + size * Math.cos(angle),
      y: y + size * Math.sin(angle) * tilt
    });
  }
  return points;
};

export const getIsometricHexPoints = (x: number, y: number, size: number): Phaser.Types.Math.Vector2Like[] => {
  const pts: Phaser.Types.Math.Vector2Like[] = [];

  // flat-space corner angles for a FLAT-topped hex:
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI/6 + i * Math.PI/3; // 30°, 90°, 150°, …
    const fx = Math.cos(angle) * size;        // flat X offset
    const fy = Math.sin(angle) * size;        // flat Y offset

    // project each corner into iso:
    const ix = fx - fy;
    const iy = (fx + fy) * 0.5;

    pts.push({
      x: x + ix,
      y: y + iy
    });
  }

  return pts;
};

// Generate spiral of hex coordinates from center
export const spiralRing = (center: CubeCoords, radius: number): CubeCoords[] => {
  if (radius === 0) return [center];
  
  const results: CubeCoords[] = [];
  let current = cubeAdd(center, cubeScale(hexDirections[4], radius)); // Start from direction 4 (bottom-left)
  
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(current);
      current = cubeAdd(current, hexDirections[i]);
    }
  }
  
  return results;
};

export const generateHexSpiral = (center: CubeCoords, maxRadius: number): CubeCoords[] => {
  const results: CubeCoords[] = [center];
  for (let radius = 1; radius <= maxRadius; radius++) {
    results.push(...spiralRing(center, radius));
  }
  return results;
};

// Pathfinding A* algorithm for hex grid
export const findPath = (start: CubeCoords, goal: CubeCoords, isBlocked: (coords: CubeCoords) => boolean): CubeCoords[] => {
  const openSet = new Set<string>([coordsToKey(start)]);
  const cameFrom = new Map<string, CubeCoords>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  gScore.set(coordsToKey(start), 0);
  fScore.set(coordsToKey(start), cubeDistance(start, goal));
  
  while (openSet.size > 0) {
    const currentKey = Array.from(openSet).reduce((a, b) => 
      (fScore.get(a) || Infinity) < (fScore.get(b) || Infinity) ? a : b
    );
    
    const current = keyToCoords(currentKey);
    
    if (coordsEqual(current, goal)) {
      // Reconstruct path
      const path: CubeCoords[] = [];
      let curr = current;
      while (cameFrom.has(coordsToKey(curr))) {
        path.unshift(curr);
        curr = cameFrom.get(coordsToKey(curr))!;
      }
      path.unshift(start);
      return path;
    }
    
    openSet.delete(currentKey);
    
    for (const neighbor of getNeighbors(current)) {
      if (isBlocked(neighbor)) continue;
      
      const tentativeGScore = (gScore.get(currentKey) || 0) + 1;
      const neighborKey = coordsToKey(neighbor);
      
      if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + cubeDistance(neighbor, goal));
        openSet.add(neighborKey);
      }
    }
  }
  
  return []; // No path found
};

// Helper functions
export const coordsToKey = (coords: CubeCoords): string => `${coords.q},${coords.r},${coords.s}`;
export const keyToCoords = (key: string): CubeCoords => {
  const [q, r, s] = key.split(',').map(Number);
  return { q, r, s };
};
export const coordsEqual = (a: CubeCoords, b: CubeCoords): boolean => 
  a.q === b.q && a.r === b.r && a.s === b.s;

// Check if two hex coordinates are adjacent (distance of 1)
export const areAdjacent = (a: CubeCoords, b: CubeCoords): boolean =>
  cubeDistance(a, b) === 1;

// Scale cube coordinates by a factor
export const cubeScale = (coords: CubeCoords, factor: number): CubeCoords => ({
  q: coords.q * factor,
  r: coords.r * factor,
  s: coords.s * factor,
});