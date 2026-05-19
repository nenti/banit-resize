# Pixel Art Downscaler

Convert AI-generated "fake pixel art" (large images with baked-in checkerboard transparency) into real small PNGs with true alpha transparency.

## What it does

1. **Upload** a large pixel-art-style image (PNG/JPG)
2. **Crop** the region you want to keep
3. **Pick transparent colors** with the eyedropper, or use the checkerboard preset (white + gray)
4. **Set output size** (1–512 px) — defaults to 32×32
5. **Download** a sharp PNG with real transparency

All processing happens in your browser — images never leave your device.

## Usage

```bash
npm install
npm run dev
```

Open the local URL, drop an image, adjust settings, and download.

### Tips

- Use **Pick color** and click the fake transparency tiles on your image
- **Checkerboard preset** adds white (#FFFFFF) and light gray (#C0C0C0) as transparent
- Right-click **Checkerboard preset** to auto-detect the pair from a picked color
- Adjust **Color tolerance** if some background pixels remain
- Lock aspect ratio to keep output proportional to your crop

## Build & deploy

```bash
npm run build
```

Deploy the `dist/` folder to any static host (Netlify, GitHub Pages, Cloudflare Pages, etc.).

Preview production build locally:

```bash
npm run preview
```

## How it works

For each output pixel, the tool samples the **center** of the corresponding block in the source image (nearest-neighbor at block level). Colors matching your transparent list (within tolerance) get alpha = 0. No bilinear blur — edges stay crisp.
