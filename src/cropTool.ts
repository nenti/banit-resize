export type CropRect = { x: number; y: number; w: number; h: number };

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

const MIN_CROP_SIZE = 8;
const HANDLE_SIZE = 10;

export class CropTool {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private crop: CropRect = { x: 0, y: 0, w: 0, h: 0 };
  private scale = 1;
  private dragMode: DragMode = null;
  private dragStart = { x: 0, y: 0 };
  private cropStart: CropRect = { x: 0, y: 0, w: 0, h: 0 };
  private onChange: (crop: CropRect) => void;
  private eyedropperActive = false;
  private onEyedropperPick: ((x: number, y: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, onChange: (crop: CropRect) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D canvas context');
    }
    this.ctx = ctx;
    this.onChange = onChange;

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseUp);
  }

  setImage(image: HTMLImageElement): void {
    this.image = image;
    this.crop = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
    this.fitToContainer();
    this.draw();
    this.onChange(this.crop);
  }

  getCrop(): CropRect {
    return { ...this.crop };
  }

  setEyedropperActive(active: boolean, onPick?: (x: number, y: number) => void): void {
    this.eyedropperActive = active;
    this.onEyedropperPick = onPick ?? null;
    this.canvas.style.cursor = active ? 'crosshair' : 'default';
  }

  getImageData(): ImageData | null {
    if (!this.image) return null;
    const offscreen = document.createElement('canvas');
    offscreen.width = this.image.naturalWidth;
    offscreen.height = this.image.naturalHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(this.image, 0, 0);
    return ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  }

  private fitToContainer(): void {
    if (!this.image) return;
    const container = this.canvas.parentElement;
    if (!container) return;

    const maxWidth = container.clientWidth - 32;
    const maxHeight = 480;
    const scaleX = maxWidth / this.image.naturalWidth;
    const scaleY = maxHeight / this.image.naturalHeight;
    this.scale = Math.min(scaleX, scaleY, 1);

    this.canvas.width = Math.floor(this.image.naturalWidth * this.scale);
    this.canvas.height = Math.floor(this.image.naturalHeight * this.scale);
  }

  private toImageCoords(canvasX: number, canvasY: number): { x: number; y: number } {
    return {
      x: canvasX / this.scale,
      y: canvasY / this.scale,
    };
  }

  private toCanvasCoords(imageX: number, imageY: number): { x: number; y: number } {
    return {
      x: imageX * this.scale,
      y: imageY * this.scale,
    };
  }

  private getDragMode(canvasX: number, canvasY: number): DragMode {
    const { x, y, w, h } = this.crop;
    const topLeft = this.toCanvasCoords(x, y);
    const bottomRight = this.toCanvasCoords(x + w, y + h);
    const hs = HANDLE_SIZE;

    const near = (px: number, py: number, tx: number, ty: number) =>
      Math.abs(px - tx) <= hs && Math.abs(py - ty) <= hs;

    if (near(canvasX, canvasY, topLeft.x, topLeft.y)) return 'nw';
    if (near(canvasX, canvasY, bottomRight.x, topLeft.y)) return 'ne';
    if (near(canvasX, canvasY, topLeft.x, bottomRight.y)) return 'sw';
    if (near(canvasX, canvasY, bottomRight.x, bottomRight.y)) return 'se';

    const midX = (topLeft.x + bottomRight.x) / 2;
    const midY = (topLeft.y + bottomRight.y) / 2;
    if (near(canvasX, canvasY, midX, topLeft.y)) return 'n';
    if (near(canvasX, canvasY, midX, bottomRight.y)) return 's';
    if (near(canvasX, canvasY, topLeft.x, midY)) return 'w';
    if (near(canvasX, canvasY, bottomRight.x, midY)) return 'e';

    if (
      canvasX >= topLeft.x &&
      canvasX <= bottomRight.x &&
      canvasY >= topLeft.y &&
      canvasY <= bottomRight.y
    ) {
      return 'move';
    }

    return null;
  }

  private clampCrop(): void {
    if (!this.image) return;
    const maxW = this.image.naturalWidth;
    const maxH = this.image.naturalHeight;

    this.crop.w = Math.max(MIN_CROP_SIZE, Math.min(this.crop.w, maxW));
    this.crop.h = Math.max(MIN_CROP_SIZE, Math.min(this.crop.h, maxH));
    this.crop.x = Math.max(0, Math.min(this.crop.x, maxW - this.crop.w));
    this.crop.y = Math.max(0, Math.min(this.crop.y, maxH - this.crop.h));
  }

  private handleMouseDown = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    if (this.eyedropperActive && this.onEyedropperPick) {
      const imageCoords = this.toImageCoords(canvasX, canvasY);
      this.onEyedropperPick(Math.floor(imageCoords.x), Math.floor(imageCoords.y));
      return;
    }

    this.dragMode = this.getDragMode(canvasX, canvasY);
    if (!this.dragMode) return;

    this.dragStart = this.toImageCoords(canvasX, canvasY);
    this.cropStart = { ...this.crop };
  };

  private handleMouseMove = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    if (this.eyedropperActive) {
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (!this.dragMode) {
      const mode = this.getDragMode(canvasX, canvasY);
      this.canvas.style.cursor = mode === 'move' ? 'move' : mode ? 'pointer' : 'default';
      return;
    }

    const current = this.toImageCoords(canvasX, canvasY);
    const dx = current.x - this.dragStart.x;
    const dy = current.y - this.dragStart.y;
    const start = this.cropStart;

    switch (this.dragMode) {
      case 'move':
        this.crop.x = start.x + dx;
        this.crop.y = start.y + dy;
        break;
      case 'nw':
        this.crop.x = start.x + dx;
        this.crop.y = start.y + dy;
        this.crop.w = start.w - dx;
        this.crop.h = start.h - dy;
        break;
      case 'ne':
        this.crop.y = start.y + dy;
        this.crop.w = start.w + dx;
        this.crop.h = start.h - dy;
        break;
      case 'sw':
        this.crop.x = start.x + dx;
        this.crop.w = start.w - dx;
        this.crop.h = start.h + dy;
        break;
      case 'se':
        this.crop.w = start.w + dx;
        this.crop.h = start.h + dy;
        break;
      case 'n':
        this.crop.y = start.y + dy;
        this.crop.h = start.h - dy;
        break;
      case 's':
        this.crop.h = start.h + dy;
        break;
      case 'w':
        this.crop.x = start.x + dx;
        this.crop.w = start.w - dx;
        break;
      case 'e':
        this.crop.w = start.w + dx;
        break;
    }

    this.clampCrop();
    this.draw();
    this.onChange(this.crop);
  };

  private handleMouseUp = (): void => {
    this.dragMode = null;
  };

  draw(): void {
    if (!this.image) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);

    const topLeft = this.toCanvasCoords(this.crop.x, this.crop.y);
    const cropW = this.crop.w * this.scale;
    const cropH = this.crop.h * this.scale;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.canvas.width, topLeft.y);
    this.ctx.fillRect(0, topLeft.y + cropH, this.canvas.width, this.canvas.height - topLeft.y - cropH);
    this.ctx.fillRect(0, topLeft.y, topLeft.x, cropH);
    this.ctx.fillRect(topLeft.x + cropW, topLeft.y, this.canvas.width - topLeft.x - cropW, cropH);

    this.ctx.strokeStyle = '#6ea8fe';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(topLeft.x, topLeft.y, cropW, cropH);

    this.ctx.fillStyle = '#6ea8fe';
    const handles = [
      [topLeft.x, topLeft.y],
      [topLeft.x + cropW, topLeft.y],
      [topLeft.x, topLeft.y + cropH],
      [topLeft.x + cropW, topLeft.y + cropH],
      [topLeft.x + cropW / 2, topLeft.y],
      [topLeft.x + cropW / 2, topLeft.y + cropH],
      [topLeft.x, topLeft.y + cropH / 2],
      [topLeft.x + cropW, topLeft.y + cropH / 2],
    ];
    for (const [hx, hy] of handles) {
      this.ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  resize(): void {
    if (!this.image) return;
    this.fitToContainer();
    this.draw();
  }
}
