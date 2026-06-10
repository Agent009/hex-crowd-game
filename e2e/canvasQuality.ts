import { expect, type Page } from '@playwright/test';
import { inflateSync } from 'node:zlib';

type CanvasRenderStats = {
  width: number;
  height: number;
  sampledPixels: number;
  opaquePixels: number;
  uniqueColors: number;
  colorDetailPixels: number;
  edgeContrastPixels: number;
};

type DecodedPng = {
  width: number;
  height: number;
  rgba: Buffer;
};

function paethPredictor(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePng(png: Buffer): DecodedPng {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(pngSignature)) {
    throw new Error('Canvas screenshot is not a PNG.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const chunkType = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (chunkType === 'IHDR') {
      width = png.readUInt32BE(dataStart);
      height = png.readUInt32BE(dataStart + 4);
      bitDepth = png[dataStart + 8] ?? 0;
      colorType = png[dataStart + 9] ?? 0;
    } else if (chunkType === 'IDAT') {
      idatChunks.push(png.subarray(dataStart, dataEnd));
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}.`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset] ?? 0;
    inputOffset += 1;
    const rowOffset = y * stride;
    const previousRowOffset = rowOffset - stride;

    for (let x = 0; x < stride; x += 1) {
      const current = inflated[inputOffset] ?? 0;
      inputOffset += 1;

      const left = x >= bytesPerPixel ? raw[rowOffset + x - bytesPerPixel] ?? 0 : 0;
      const up = y > 0 ? raw[previousRowOffset + x] ?? 0 : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[previousRowOffset + x - bytesPerPixel] ?? 0 : 0;

      let value = current;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}.`);

      raw[rowOffset + x] = value & 0xff;
    }
  }

  if (colorType === 6) {
    return { width, height, rgba: raw };
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    rgba[index * 4] = raw[index * 3] ?? 0;
    rgba[index * 4 + 1] = raw[index * 3 + 1] ?? 0;
    rgba[index * 4 + 2] = raw[index * 3 + 2] ?? 0;
    rgba[index * 4 + 3] = 255;
  }

  return { width, height, rgba };
}

function readCanvasRenderStats(png: Buffer): CanvasRenderStats {
  const { width, height, rgba } = decodePng(png);
  const sampleStep = Math.max(1, Math.floor(Math.sqrt((width * height) / 8_000)));
  const colors = new Set<string>();
  let sampledPixels = 0;
  let opaquePixels = 0;
  let colorDetailPixels = 0;
  let edgeContrastPixels = 0;
  let previousLuma: number | null = null;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const offset = (y * width + x) * 4;
      const red = rgba[offset] ?? 0;
      const green = rgba[offset + 1] ?? 0;
      const blue = rgba[offset + 2] ?? 0;
      const alpha = rgba[offset + 3] ?? 0;

      sampledPixels += 1;

      if (alpha < 8) {
        previousLuma = null;
        continue;
      }

      opaquePixels += 1;
      colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);

      const brightestChannel = Math.max(red, green, blue);
      const darkestChannel = Math.min(red, green, blue);
      if (brightestChannel > 35 && brightestChannel - darkestChannel > 18) {
        colorDetailPixels += 1;
      }

      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (previousLuma !== null && Math.abs(luma - previousLuma) > 18) {
        edgeContrastPixels += 1;
      }

      previousLuma = luma;
    }
  }

  return {
    width,
    height,
    sampledPixels,
    opaquePixels,
    uniqueColors: colors.size,
    colorDetailPixels,
    edgeContrastPixels,
  };
}

export async function expectCanvasHasRichRendering(page: Page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  const screenshot = await canvas.screenshot({ type: 'png' });
  const stats = readCanvasRenderStats(screenshot);
  const detail = JSON.stringify(stats);

  expect(stats.width, detail).toBeGreaterThan(500);
  expect(stats.height, detail).toBeGreaterThan(400);
  expect(stats.sampledPixels, detail).toBeGreaterThan(1_000);
  expect(stats.opaquePixels, detail).toBeGreaterThan(stats.sampledPixels * 0.5);
  expect(stats.uniqueColors, detail).toBeGreaterThan(24);
  expect(stats.colorDetailPixels, detail).toBeGreaterThan(120);
  expect(stats.edgeContrastPixels, detail).toBeGreaterThan(60);
}
