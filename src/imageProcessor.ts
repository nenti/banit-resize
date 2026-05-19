import { isTransparent, type RgbColor } from './colorPicker';

export type CropRect = { x: number; y: number; w: number; h: number };
export type OutputSize = { w: number; h: number };

export type ProcessOptions = {
  source: ImageData;
  crop: CropRect;
  output: OutputSize;
  transparentColors: RgbColor[];
  tolerance: number;
};

export type BlockSize = { blockW: number; blockH: number };

export function computeBlockSize(crop: CropRect, output: OutputSize): BlockSize {
  return {
    blockW: crop.w / output.w,
    blockH: crop.h / output.h,
  };
}

export function processPixelArt(options: ProcessOptions): ImageData {
  const { source, crop, output, transparentColors, tolerance } = options;
  const { blockW, blockH } = computeBlockSize(crop, output);
  const result = new ImageData(output.w, output.h);

  for (let oy = 0; oy < output.h; oy++) {
    for (let ox = 0; ox < output.w; ox++) {
      const sx = Math.floor(crop.x + ox * blockW + blockW / 2);
      const sy = Math.floor(crop.y + oy * blockH + blockH / 2);
      const clampedX = Math.max(0, Math.min(source.width - 1, sx));
      const clampedY = Math.max(0, Math.min(source.height - 1, sy));
      const srcIndex = (clampedY * source.width + clampedX) * 4;

      const r = source.data[srcIndex];
      const g = source.data[srcIndex + 1];
      const b = source.data[srcIndex + 2];

      const dstIndex = (oy * output.w + ox) * 4;
      result.data[dstIndex] = r;
      result.data[dstIndex + 1] = g;
      result.data[dstIndex + 2] = b;
      result.data[dstIndex + 3] = isTransparent(r, g, b, transparentColors, tolerance) ? 0 : 255;
    }
  }

  return result;
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D canvas context');
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    image.src = url;
  });
}

export function imageToImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D canvas context');
  }
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function downloadPng(imageData: ImageData, filename: string): void {
  const canvas = imageDataToCanvas(imageData);
  canvas.toBlob((blob) => {
    if (!blob) {
      throw new Error('Failed to encode PNG');
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function clampOutputSize(value: number): number {
  return Math.max(1, Math.min(512, Math.round(value)));
}
