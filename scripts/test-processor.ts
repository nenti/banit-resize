/**
 * Generates a synthetic upscaled pixel-art image and verifies downscaling.
 * Run: npx tsx scripts/test-processor.ts
 */

class ImageDataPolyfill {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

(globalThis as unknown as { ImageData: typeof ImageDataPolyfill }).ImageData =
  ImageDataPolyfill as unknown as typeof ImageData;

import {
  computeBlockSize,
  processPixelArt,
} from '../src/imageProcessor';
import {
  detectCheckerboard,
  getCheckerboardPair,
  isTransparent,
} from '../src/colorPicker';

const LOGICAL_SIZE = 32;
const BLOCK_SIZE = 32;
const IMAGE_SIZE = LOGICAL_SIZE * BLOCK_SIZE;

function setPixel(
  image: ImageDataPolyfill,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const index = (y * image.width + x) * 4;
  image.data[index] = r;
  image.data[index + 1] = g;
  image.data[index + 2] = b;
  image.data[index + 3] = a;
}

function fillBlock(
  image: ImageDataPolyfill,
  blockX: number,
  blockY: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let dy = 0; dy < BLOCK_SIZE; dy++) {
    for (let dx = 0; dx < BLOCK_SIZE; dx++) {
      setPixel(image, blockX * BLOCK_SIZE + dx, blockY * BLOCK_SIZE + dy, r, g, b);
    }
  }
}

function createTestImage(): ImageDataPolyfill {
  const image = new ImageDataPolyfill(IMAGE_SIZE, IMAGE_SIZE);
  const white = { r: 255, g: 255, b: 255 };
  const gray = { r: 192, g: 192, b: 192 };

  for (let by = 0; by < LOGICAL_SIZE; by++) {
    for (let bx = 0; bx < LOGICAL_SIZE; bx++) {
      const isCheckerWhite = (bx + by) % 2 === 0;
      const bg = isCheckerWhite ? white : gray;
      fillBlock(image, bx, by, bg.r, bg.g, bg.b);
    }
  }

  const center = LOGICAL_SIZE / 2;
  const radius = 10;
  for (let by = 0; by < LOGICAL_SIZE; by++) {
    for (let bx = 0; bx < LOGICAL_SIZE; bx++) {
      const dist = Math.hypot(bx - center + 0.5, by - center + 0.5);
      if (dist <= radius) {
        const t = (bx + by) / (LOGICAL_SIZE * 2);
        const r = Math.floor(255 * Math.abs(Math.sin(t * Math.PI * 2)));
        const g = Math.floor(128 + 127 * Math.sin(t * Math.PI * 4));
        const b = Math.floor(255 * (1 - t));
        fillBlock(image, bx, by, r, g, b);
      }
    }
  }

  return image;
}

function countOpaquePixels(image: ImageData): number {
  let count = 0;
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] > 0) count++;
  }
  return count;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const source = createTestImage();
const transparentColors = detectCheckerboard(source as unknown as ImageData);

assert(transparentColors !== null, 'Should detect checkerboard from corners');

const outputSizes = [32, 64, 128] as const;

for (const size of outputSizes) {
  const result = processPixelArt({
    source: source as unknown as ImageData,
    crop: { x: 0, y: 0, w: IMAGE_SIZE, h: IMAGE_SIZE },
    output: { w: size, h: size },
    transparentColors: transparentColors!,
    tolerance: 20,
  });

  assert(result.width === size, `Expected width ${size}, got ${result.width}`);
  assert(result.height === size, `Expected height ${size}, got ${result.height}`);

  const block = computeBlockSize(
    { x: 0, y: 0, w: IMAGE_SIZE, h: IMAGE_SIZE },
    { w: size, h: size },
  );
  assert(
    Math.abs(block.blockW - IMAGE_SIZE / size) < 0.001,
    `Block width should be ${IMAGE_SIZE / size}`,
  );

  const opaque = countOpaquePixels(result);
  assert(opaque > 0, `Output ${size}x${size} should have opaque orb pixels`);
  assert(
    opaque < size * size,
    `Output ${size}x${size} should have transparent background pixels`,
  );

  for (let i = 0; i < result.data.length; i += 4) {
    const r = result.data[i];
    const g = result.data[i + 1];
    const b = result.data[i + 2];
    const a = result.data[i + 3];
    if (a === 0) {
      assert(
        isTransparent(r, g, b, getCheckerboardPair(), 20),
        'Transparent pixels should match checkerboard colors',
      );
    }
  }

  console.log(`✓ ${size}x${size}: ${opaque} opaque pixels, block ${block.blockW.toFixed(1)}px`);
}

console.log('\nAll processor tests passed.');
