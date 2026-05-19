import './styles.css';
import { CropTool } from './cropTool';
import {
  colorsEqual,
  detectCheckerboard,
  findCheckerboardPairFromColor,
  getCheckerboardPair,
  getPixelColor,
  rgbToHex,
  type RgbColor,
} from './colorPicker';
import {
  clampOutputSize,
  computeBlockSize,
  downloadPng,
  imageToImageData,
  loadImageFromFile,
  processPixelArt,
} from './imageProcessor';

type AppState = {
  sourceImageData: ImageData | null;
  transparentColors: RgbColor[];
  tolerance: number;
  outputW: number;
  outputH: number;
  linkAspect: boolean;
  cropAspect: number;
  filename: string;
};

const state: AppState = {
  sourceImageData: null,
  transparentColors: [],
  tolerance: 20,
  outputW: 32,
  outputH: 32,
  linkAspect: true,
  cropAspect: 1,
  filename: 'pixelart-32x32.png',
};

const sourceCanvas = document.querySelector<HTMLCanvasElement>('#source-canvas')!;
const previewCanvas = document.querySelector<HTMLCanvasElement>('#preview-canvas')!;
const dropZone = document.querySelector<HTMLDivElement>('#drop-zone')!;
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!;
const outputWidthInput = document.querySelector<HTMLInputElement>('#output-width')!;
const outputHeightInput = document.querySelector<HTMLInputElement>('#output-height')!;
const linkAspectInput = document.querySelector<HTMLInputElement>('#link-aspect')!;
const toleranceInput = document.querySelector<HTMLInputElement>('#tolerance')!;
const toleranceValue = document.querySelector<HTMLSpanElement>('#tolerance-value')!;
const colorList = document.querySelector<HTMLDivElement>('#color-list')!;
const blockSizeLabel = document.querySelector<HTMLSpanElement>('#block-size')!;
const aspectWarning = document.querySelector<HTMLParagraphElement>('#aspect-warning')!;
const previewDimensions = document.querySelector<HTMLSpanElement>('#preview-dimensions')!;
const filenameInput = document.querySelector<HTMLInputElement>('#filename')!;
const pickColorBtn = document.querySelector<HTMLButtonElement>('#pick-color')!;
const checkerboardBtn = document.querySelector<HTMLButtonElement>('#checkerboard-preset')!;
const downloadBtn = document.querySelector<HTMLButtonElement>('#download')!;
const presetButtons = document.querySelectorAll<HTMLButtonElement>('[data-preset]');

let eyedropperActive = false;

const cropTool = new CropTool(sourceCanvas, () => {
  updateCropAspect();
  processAndPreview();
});

function updateFilename(): void {
  state.filename = `pixelart-${state.outputW}x${state.outputH}.png`;
  filenameInput.value = state.filename;
}

function updateCropAspect(): void {
  const crop = cropTool.getCrop();
  state.cropAspect = crop.w / crop.h;
}

function setOutputSize(width: number, height: number): void {
  state.outputW = clampOutputSize(width);
  state.outputH = clampOutputSize(height);
  outputWidthInput.value = String(state.outputW);
  outputHeightInput.value = String(state.outputH);
  updateFilename();
}

function renderColorList(): void {
  colorList.innerHTML = '';

  if (state.transparentColors.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'color-list-empty';
    empty.textContent = 'No transparent colors selected';
    colorList.appendChild(empty);
    return;
  }

  for (const color of state.transparentColors) {
    const item = document.createElement('div');
    item.className = 'color-item';

    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = rgbToHex(color);

    const label = document.createElement('span');
    label.className = 'color-label';
    label.textContent = rgbToHex(color).toUpperCase();

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-small btn-danger';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      state.transparentColors = state.transparentColors.filter((c) => !colorsEqual(c, color));
      renderColorList();
      processAndPreview();
    });

    item.append(swatch, label, removeBtn);
    colorList.appendChild(item);
  }
}

function addTransparentColor(color: RgbColor): void {
  if (state.transparentColors.some((existing) => colorsEqual(existing, color))) {
    return;
  }
  state.transparentColors.push(color);
  renderColorList();
  processAndPreview();
}

function addTransparentColors(colors: RgbColor[]): void {
  for (const color of colors) {
    if (!state.transparentColors.some((existing) => colorsEqual(existing, color))) {
      state.transparentColors.push(color);
    }
  }
  renderColorList();
  processAndPreview();
}

function processAndPreview(): void {
  aspectWarning.hidden = true;
  blockSizeLabel.textContent = '—';
  previewDimensions.textContent = '—';
  downloadBtn.disabled = true;

  const ctx = previewCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  if (!state.sourceImageData) {
    return;
  }

  const crop = cropTool.getCrop();
  const cropAspect = crop.w / crop.h;
  const outputAspect = state.outputW / state.outputH;

  if (Math.abs(cropAspect - outputAspect) > 0.01) {
    aspectWarning.hidden = false;
  }

  const { blockW, blockH } = computeBlockSize(crop, { w: state.outputW, h: state.outputH });
  blockSizeLabel.textContent = `${blockW.toFixed(1)} × ${blockH.toFixed(1)} source px`;

  const result = processPixelArt({
    source: state.sourceImageData,
    crop,
    output: { w: state.outputW, h: state.outputH },
    transparentColors: state.transparentColors,
    tolerance: state.tolerance,
  });

  previewCanvas.width = result.width;
  previewCanvas.height = result.height;
  ctx.putImageData(result, 0, 0);

  previewDimensions.textContent = `${result.width} × ${result.height} px`;
  downloadBtn.disabled = false;

  previewCanvas.dataset.result = 'ready';
}

async function handleFile(file: File): Promise<void> {
  const image = await loadImageFromFile(file);
  state.sourceImageData = imageToImageData(image);
  cropTool.setImage(image);

  state.transparentColors = detectCheckerboard(state.sourceImageData) ?? [];
  renderColorList();
  updateCropAspect();
  processAndPreview();

  dropZone.classList.add('has-image');
  sourceCanvas.hidden = false;
  const hint = dropZone.querySelector('p');
  if (hint) hint.hidden = true;
}

function setEyedropperActive(active: boolean): void {
  eyedropperActive = active;
  pickColorBtn.classList.toggle('active', active);
  pickColorBtn.textContent = active ? 'Click image to pick…' : 'Pick color';

  cropTool.setEyedropperActive(active, (x, y) => {
    if (!state.sourceImageData) return;
    const color = getPixelColor(state.sourceImageData, x, y);
    addTransparentColor(color);
    setEyedropperActive(false);
  });
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) {
    void handleFile(file);
  }
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = event.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) {
    void handleFile(file);
  }
});

dropZone.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('#source-canvas')) return;
  fileInput.click();
});

outputWidthInput.addEventListener('input', () => {
  const width = clampOutputSize(Number(outputWidthInput.value));
  if (state.linkAspect) {
    const height = clampOutputSize(width / state.cropAspect);
    setOutputSize(width, height);
  } else {
    state.outputW = width;
  }
  updateFilename();
  processAndPreview();
});

outputHeightInput.addEventListener('input', () => {
  const height = clampOutputSize(Number(outputHeightInput.value));
  if (state.linkAspect) {
    const width = clampOutputSize(height * state.cropAspect);
    setOutputSize(width, height);
  } else {
    state.outputH = height;
  }
  updateFilename();
  processAndPreview();
});

linkAspectInput.addEventListener('change', () => {
  state.linkAspect = linkAspectInput.checked;
  if (state.linkAspect) {
    const height = clampOutputSize(state.outputW / state.cropAspect);
    setOutputSize(state.outputW, height);
    processAndPreview();
  }
});

toleranceInput.addEventListener('input', () => {
  state.tolerance = Number(toleranceInput.value);
  toleranceValue.textContent = String(state.tolerance);
  processAndPreview();
});

pickColorBtn.addEventListener('click', () => {
  if (!state.sourceImageData) return;
  setEyedropperActive(!eyedropperActive);
});

checkerboardBtn.addEventListener('click', () => {
  addTransparentColors(getCheckerboardPair());
});

checkerboardBtn.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (!state.sourceImageData || state.transparentColors.length === 0) {
    addTransparentColors(getCheckerboardPair());
    return;
  }
  const picked = state.transparentColors[0];
  addTransparentColors(findCheckerboardPairFromColor(state.sourceImageData, picked, state.tolerance));
});

downloadBtn.addEventListener('click', () => {
  if (!state.sourceImageData || previewCanvas.dataset.result !== 'ready') return;

  const crop = cropTool.getCrop();
  const result = processPixelArt({
    source: state.sourceImageData,
    crop,
    output: { w: state.outputW, h: state.outputH },
    transparentColors: state.transparentColors,
    tolerance: state.tolerance,
  });

  const filename = filenameInput.value.trim() || state.filename;
  downloadPng(result, filename.endsWith('.png') ? filename : `${filename}.png`);
});

filenameInput.addEventListener('input', () => {
  state.filename = filenameInput.value;
});

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const size = Number(button.dataset.preset);
    if (state.linkAspect) {
      const height = clampOutputSize(size / state.cropAspect);
      setOutputSize(size, height);
    } else {
      setOutputSize(size, size);
    }
    processAndPreview();
  });
});

window.addEventListener('resize', () => {
  cropTool.resize();
});

renderColorList();
updateFilename();
