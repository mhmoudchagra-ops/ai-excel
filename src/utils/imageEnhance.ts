import type { ImageEnhancementMode } from '../types/table';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر تحميل الصورة للمعالجة.'));
    img.src = src;
  });
}

/**
 * Estimates local background illumination via downsampled box smoothing
 * and normalizes brightness so shadows, uneven room lighting, and paper tint
 * do not obscure faint or small table text.
 */
function flattenUnevenLighting(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grayscaleMode: boolean
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Coarse grid for fast local illumination estimation
  const scale = 16;
  const gw = Math.max(4, Math.ceil(width / scale));
  const gh = Math.max(4, Math.ceil(height / scale));
  const bgGrid = new Float32Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    const y0 = gy * scale;
    const y1 = Math.min(height, y0 + scale);
    for (let gx = 0; gx < gw; gx++) {
      const x0 = gx * scale;
      const x1 = Math.min(width, x0 + scale);
      let maxLum = 40;
      // Sample stride 2 inside block to find local paper/background brightness
      for (let y = y0; y < y1; y += 2) {
        const rowOffset = y * width;
        for (let x = x0; x < x1; x += 2) {
          const i = (rowOffset + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum > maxLum) maxLum = lum;
        }
      }
      bgGrid[gy * gw + gx] = maxLum;
    }
  }

  // Smooth the background illumination grid (3x3 box pass x2)
  let smoothed = new Float32Array(bgGrid);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = gy + dy;
          if (ny < 0 || ny >= gh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            if (nx < 0 || nx >= gw) continue;
            sum += smoothed[ny * gw + nx];
            count++;
          }
        }
        next[gy * gw + gx] = sum / count;
      }
    }
    smoothed = next;
  }

  const strength = grayscaleMode ? 0.92 : 0.68;
  const contrast = grayscaleMode ? 1.38 : 1.18;

  for (let y = 0; y < height; y++) {
    const gyf = Math.min(gh - 1.001, y / scale);
    const gy0 = Math.floor(gyf);
    const gy1 = Math.min(gh - 1, gy0 + 1);
    const fy = gyf - gy0;

    for (let x = 0; x < width; x++) {
      const gxf = Math.min(gw - 1.001, x / scale);
      const gx0 = Math.floor(gxf);
      const gx1 = Math.min(gw - 1, gx0 + 1);
      const fx = gxf - gx0;

      // Bilinear interpolation of local illumination
      const b00 = smoothed[gy0 * gw + gx0];
      const b10 = smoothed[gy0 * gw + gx1];
      const b01 = smoothed[gy1 * gw + gx0];
      const b11 = smoothed[gy1 * gw + gx1];
      const localBg =
        b00 * (1 - fx) * (1 - fy) +
        b10 * fx * (1 - fy) +
        b01 * (1 - fx) * fy +
        b11 * fx * fy;

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Normalize pixel against local bright envelope -> lifts shadowed areas
      const targetBg = 248;
      const gain = 1 + ((targetBg / Math.max(localBg, 48)) - 1) * strength;

      if (grayscaleMode) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        let norm = lum * gain;
        // S-curve contrast around document mid-high threshold to sharpen ink vs paper
        norm = ((norm / 255 - 0.58) * contrast + 0.58) * 255;
        const clamped = Math.max(0, Math.min(255, norm));
        data[idx] = clamped;
        data[idx + 1] = clamped;
        data[idx + 2] = clamped;
      } else {
        const nr = ((r * gain) / 255 - 0.5) * contrast + 0.5;
        const ng = ((g * gain) / 255 - 0.5) * contrast + 0.5;
        const nb = ((b * gain) / 255 - 0.5) * contrast + 0.5;
        data[idx] = Math.max(0, Math.min(255, nr * 255));
        data[idx + 1] = Math.max(0, Math.min(255, ng * 255));
        data[idx + 2] = Math.max(0, Math.min(255, nb * 255));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Applies a subtle 3x3 unsharp-mask convolution to sharpen small fonts,
 * Arabic dots/diacritics, and thin table grid lines.
 */
function applySharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount = 0.35
): void {
  const srcData = ctx.getImageData(0, 0, width, height);
  const dstData = ctx.createImageData(width, height);
  const src = srcData.data;
  const dst = dstData.data;

  const center = 1 + 4 * amount;
  const side = -amount;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        dst[idx] = src[idx];
        dst[idx + 1] = src[idx + 1];
        dst[idx + 2] = src[idx + 2];
        dst[idx + 3] = src[idx + 3];
        continue;
      }

      const up = ((y - 1) * width + x) * 4;
      const down = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          src[idx + c] * center +
          (src[up + c] + src[down + c] + src[left + c] + src[right + c]) * side;
        dst[idx + c] = Math.max(0, Math.min(255, val));
      }
      dst[idx + 3] = src[idx + 3];
    }
  }

  ctx.putImageData(dstData, 0, 0);
}

export async function prepareImageForOcr(
  dataUrl: string,
  rotationDeg: number,
  mode: ImageEnhancementMode
): Promise<{ dataUrl: string; base64: string; mimeType: string; wasUpscaled: boolean }> {
  const img = await loadImage(dataUrl);
  const normalizedRot = ((rotationDeg % 360) + 360) % 360;
  const swapDims = normalizedRot === 90 || normalizedRot === 270;

  const naturalW = swapDims ? img.height : img.width;
  const naturalH = swapDims ? img.width : img.height;
  const maxNaturalDim = Math.max(naturalW, naturalH);

  // Upscale small images/screenshots with tiny fonts to >= 1600px, cap very large photos at 2400px
  let scale = 1;
  let wasUpscaled = false;
  if (mode !== 'none') {
    if (maxNaturalDim < 1500) {
      scale = Math.min(2.2, 1750 / maxNaturalDim);
      wasUpscaled = scale > 1.05;
    } else if (maxNaturalDim > 2400) {
      scale = 2400 / maxNaturalDim;
    }
  } else if (maxNaturalDim > 2400) {
    scale = 2400 / maxNaturalDim;
  }

  const targetW = Math.round(naturalW * scale);
  const targetH = Math.round(naturalH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    const [, base64] = dataUrl.split(',');
    return { dataUrl, base64, mimeType: 'image/png', wasUpscaled: false };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.translate(targetW / 2, targetH / 2);
  ctx.rotate((normalizedRot * Math.PI) / 180);
  const drawW = swapDims ? targetH : targetW;
  const drawH = swapDims ? targetW : targetH;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  if (mode === 'auto') {
    flattenUnevenLighting(ctx, targetW, targetH, false);
    applySharpen(ctx, targetW, targetH, wasUpscaled ? 0.4 : 0.25);
  } else if (mode === 'document') {
    flattenUnevenLighting(ctx, targetW, targetH, true);
    applySharpen(ctx, targetW, targetH, 0.45);
  }

  const outDataUrl = canvas.toDataURL('image/png');
  const [, base64] = outDataUrl.split(',');
  return {
    dataUrl: outDataUrl,
    base64,
    mimeType: 'image/png',
    wasUpscaled,
  };
}
