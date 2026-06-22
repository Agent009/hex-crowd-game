import { describe, expect, it } from 'vitest';
import {
  cubeToPixel,
  pixelToCube,
  getHexPoints,
  generateHexSpiral,
  coordsEqual,
  isTacticalGrid,
  TACTICAL_TILT_Y,
  DEFAULT_HEX_SIZE,
} from './hexGrid';

// These guard the active "tactical" tilted projection: hit-testing only works
// if screen->tile maps back to the same tile the renderer drew, and the
// interactive polygon (getHexPoints) must be centred on that same pixel.
describe('hex grid projection', () => {
  const size = DEFAULT_HEX_SIZE;

  it('defaults to the tactical (tilted) grid', () => {
    // The board ships in tactical mode; if this flips, the assertions below
    // about foreshortening no longer describe the active layout.
    expect(isTacticalGrid).toBe(true);
  });

  it('round-trips every tile: pixelToCube(cubeToPixel(c)) === c', () => {
    // A click anywhere inside a tile must resolve back to that tile.
    for (const coords of generateHexSpiral({ q: 0, r: 0, s: 0 }, 6)) {
      const pixel = cubeToPixel(coords, size);
      const back = pixelToCube(pixel, size);
      expect(coordsEqual(back, coords)).toBe(true);
    }
  });

  it('resolves points sampled near the tile centre back to that tile', () => {
    // Nudge in 8 directions inside the tile (quarter-size) and confirm the
    // foreshortened inverse still lands on the right hex.
    for (const coords of generateHexSpiral({ q: 0, r: 0, s: 0 }, 4)) {
      const c = cubeToPixel(coords, size);
      for (const [dx, dy] of [
        [0, 0], [size * 0.25, 0], [-size * 0.25, 0],
        [0, size * 0.18], [0, -size * 0.18],
      ]) {
        const back = pixelToCube({ x: c.x + dx, y: c.y + dy }, size);
        expect(coordsEqual(back, coords)).toBe(true);
      }
    }
  });

  it('foreshortens the vertical axis (tilted board, not flat overhead)', () => {
    // Moving one row down (r+1) advances less in Y than the flat row pitch
    // would, by exactly the tilt factor.
    const a = cubeToPixel({ q: 0, r: 0, s: 0 }, size);
    const b = cubeToPixel({ q: 0, r: 1, s: -1 }, size);
    const flatPitch = (size * 2 * 3) / 4; // top-down row pitch
    expect(b.y - a.y).toBeCloseTo(flatPitch * TACTICAL_TILT_Y, 5);
    // Horizontal spacing is unchanged by the tilt.
    const right = cubeToPixel({ q: 1, r: 0, s: -1 }, size);
    expect(right.x - a.x).toBeCloseTo(Math.sqrt(3) * size, 5);
  });

  it('builds an interactive polygon centred on the tile pixel', () => {
    // getHexPoints(0,0) is drawn at the tile origin, so its centroid must be ~0
    // and it must be vertically squashed to match the rendered slab top.
    const pts = getHexPoints(0, 0, size);
    expect(pts).toHaveLength(6);
    const cx = pts.reduce((s, p) => s + (p.x as number), 0) / pts.length;
    const cy = pts.reduce((s, p) => s + (p.y as number), 0) / pts.length;
    expect(cx).toBeCloseTo(0, 5);
    expect(cy).toBeCloseTo(0, 5);

    const maxX = Math.max(...pts.map((p) => Math.abs(p.x as number)));
    const maxY = Math.max(...pts.map((p) => Math.abs(p.y as number)));
    // Pointy-top half-height (size) is foreshortened; half-width (√3/2·size)
    // is not — so the rendered hex is wider than tall.
    expect(maxY).toBeCloseTo(size * TACTICAL_TILT_Y, 5);
    expect(maxX).toBeGreaterThan(maxY);
  });
});
