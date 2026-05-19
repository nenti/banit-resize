export type RgbColor = { r: number; g: number; b: number };

export function rgbToHex(color: RgbColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function hexToRgb(hex: string): RgbColor | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

export function colorsEqual(a: RgbColor, b: RgbColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

export function colorDistanceSq(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export function isTransparent(
  r: number,
  g: number,
  b: number,
  colors: RgbColor[],
  tolerance: number,
): boolean {
  if (colors.length === 0) return false;
  const toleranceSq = tolerance * tolerance;
  const pixel = { r, g, b };
  return colors.some((color) => colorDistanceSq(pixel, color) <= toleranceSq);
}

export function getPixelColor(imageData: ImageData, x: number, y: number): RgbColor {
  const clampedX = Math.max(0, Math.min(imageData.width - 1, Math.floor(x)));
  const clampedY = Math.max(0, Math.min(imageData.height - 1, Math.floor(y)));
  const index = (clampedY * imageData.width + clampedX) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
  };
}

const CHECKERBOARD_WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const CHECKERBOARD_GRAY: RgbColor = { r: 192, g: 192, b: 192 };

export function getCheckerboardPair(): RgbColor[] {
  return [CHECKERBOARD_WHITE, CHECKERBOARD_GRAY];
}

export function detectCheckerboard(imageData: ImageData): RgbColor[] | null {
  const corners = [
    getPixelColor(imageData, 0, 0),
    getPixelColor(imageData, imageData.width - 1, 0),
    getPixelColor(imageData, 0, imageData.height - 1),
    getPixelColor(imageData, imageData.width - 1, imageData.height - 1),
  ];

  const hasWhite = corners.some((c) => colorDistanceSq(c, CHECKERBOARD_WHITE) <= 900);
  const hasGray = corners.some((c) => colorDistanceSq(c, CHECKERBOARD_GRAY) <= 900);

  if (hasWhite && hasGray) {
    return getCheckerboardPair();
  }

  return null;
}

export function findCheckerboardPairFromColor(
  imageData: ImageData,
  picked: RgbColor,
  tolerance: number,
): RgbColor[] {
  const toleranceSq = tolerance * tolerance;
  const candidates = new Map<string, RgbColor>();

  const samplePoints = [
    { x: 0, y: 0 },
    { x: imageData.width - 1, y: 0 },
    { x: 0, y: imageData.height - 1 },
    { x: imageData.width - 1, y: imageData.height - 1 },
    { x: Math.floor(imageData.width / 2), y: 0 },
    { x: 0, y: Math.floor(imageData.height / 2) },
  ];

  for (const point of samplePoints) {
    const color = getPixelColor(imageData, point.x, point.y);
    if (colorDistanceSq(color, picked) > toleranceSq) {
      const key = rgbToHex(color);
      candidates.set(key, color);
    }
  }

  const pair = [...candidates.values()][0];
  if (pair) {
    return [picked, pair];
  }

  return getCheckerboardPair();
}
