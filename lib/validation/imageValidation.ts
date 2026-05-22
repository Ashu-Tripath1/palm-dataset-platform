import sharp from 'sharp';
import { logger } from '../logger';

// ============================================================
// Server-side Image Validation (using Sharp)
// ============================================================

export interface ImageValidationResult {
  magicBytes: boolean;
  sharpness: boolean;
  brightnessOk: boolean;
  brightnessTooLight: boolean;
  skinTone: boolean; // soft check
  width: number;
  height: number;
  fileSizeBytes: number;
  contentType: 'image/jpeg' | 'image/png' | null;
  allHardChecksPassed: boolean;
  errorMessages: string[];
}

// ============================================================
// CHECK 8 — Magic Bytes Verification
// JPEG: FF D8 FF
// PNG:  89 50 4E 47
// ============================================================

export function checkMagicBytes(
  buffer: Buffer,
): { valid: boolean; contentType: 'image/jpeg' | 'image/png' | null } {
  if (buffer.length < 4) {
    return { valid: false, contentType: null };
  }

  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (isJpeg) return { valid: true, contentType: 'image/jpeg' };
  if (isPng) return { valid: true, contentType: 'image/png' };
  return { valid: false, contentType: null };
}

// ============================================================
// CHECK 5 — Sharpness via Laplacian Variance
// Convert to grayscale → apply Laplacian kernel → compute variance
// Threshold: variance < 100 = too blurry
// ============================================================

export async function checkSharpness(buffer: Buffer): Promise<number> {
  try {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();

    if (!width || !height) throw new Error('Invalid image dimensions');

    // Get raw grayscale pixels
    const { data } = await image
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const w = width;
    const h = height;

    // Laplacian kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const laplacian =
          pixels[idx - w] +
          pixels[idx - 1] +
          pixels[idx + 1] +
          pixels[idx + w] -
          4 * pixels[idx];
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    const variance = count > 0 ? sumSq / count : 0;
    return variance;
  } catch (error) {
    logger.error({ error }, 'Sharpness check failed');
    return 0;
  }
}

// ============================================================
// CHECK 6 — Brightness (mean pixel value)
// Too dark: mean < 60
// Overexposed: mean > 240
// ============================================================

export async function checkBrightness(
  buffer: Buffer,
): Promise<{ mean: number; tooDark: boolean; tooLight: boolean }> {
  try {
    const { data, info } = await sharp(buffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const sum = pixels.reduce((acc, val) => acc + val, 0);
    const mean = sum / (info.width * info.height);

    return {
      mean,
      tooDark: mean < 60,
      tooLight: mean > 240,
    };
  } catch (error) {
    logger.error({ error }, 'Brightness check failed');
    return { mean: 128, tooDark: false, tooLight: false };
  }
}

// ============================================================
// CHECK 7 — Skin Tone (soft check — does not hard-reject)
// Check if at least 20% of pixels are in skin-tone hue range
// Skin tone in HSL: H ≈ 0-50°, S > 10%, L: 20-90%
// ============================================================

export async function checkSkinTone(buffer: Buffer): Promise<number> {
  try {
    // Get raw RGB pixels
    const { data, info } = await sharp(buffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    let skinPixels = 0;

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // Convert RGB to HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;

      if (d === 0 || l < 0.2 || l > 0.9) continue;

      const s = d / (1 - Math.abs(2 * l - 1));
      if (s < 0.1) continue;

      let h: number;
      if (max === r) {
        h = 60 * (((g - b) / d) % 6);
      } else if (max === g) {
        h = 60 * ((b - r) / d + 2);
      } else {
        h = 60 * ((r - g) / d + 4);
      }
      if (h < 0) h += 360;

      // Skin tone hue range: 0-50° or 330-360° (reddish/orange tones)
      if ((h >= 0 && h <= 50) || h >= 330) {
        skinPixels++;
      }
    }

    return (skinPixels / totalPixels) * 100;
  } catch (error) {
    logger.error({ error }, 'Skin tone check failed');
    return 100; // Default to pass (don't flag as glove on error)
  }
}

// ============================================================
// Strip EXIF and process image (Sharp server-side guarantee)
// Returns JPEG buffer with EXIF stripped and normalized
// ============================================================

export async function processAndStripExif(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .withMetadata({ exif: {} }) // Strip all EXIF
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

// ============================================================
// Get image dimensions
// ============================================================

export async function getImageDimensions(
  buffer: Buffer,
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

// ============================================================
// Full server-side validation pipeline
// Runs all checks and returns a comprehensive result
// ============================================================

export async function validateImage(
  buffer: Buffer,
  expectedHand: 'LEFT' | 'RIGHT',
): Promise<ImageValidationResult> {
  const errors: string[] = [];

  // Check 8: Magic bytes (first, bail out early if not valid image)
  const { valid: magicBytesOk, contentType } = checkMagicBytes(buffer);
  if (!magicBytesOk) {
    return {
      magicBytes: false,
      sharpness: false,
      brightnessOk: false,
      brightnessTooLight: false,
      skinTone: true,
      width: 0,
      height: 0,
      fileSizeBytes: buffer.length,
      contentType: null,
      allHardChecksPassed: false,
      errorMessages: [
        'Invalid file type. Please upload a JPEG or PNG photo.',
      ],
    };
  }

  // Get dimensions
  const { width, height } = await getImageDimensions(buffer);

  // Check 5: Sharpness
  const sharpnessVariance = await checkSharpness(buffer);
  const isSharp = sharpnessVariance >= 100;
  if (!isSharp) {
    errors.push(
      'The photo is too blurry. Hold your phone steady and ensure good lighting.',
    );
  }

  // Check 6: Brightness
  const { tooDark, tooLight } = await checkBrightness(buffer);

  const brightnessOk = !tooDark && !tooLight;
  if (tooDark) {
    errors.push(
      'The photo is too dark. Move to a well-lit area or turn on a light.',
    );
  }
  if (tooLight) {
    errors.push(
      'The photo is overexposed. Avoid direct sunlight or very strong artificial lights.',
    );
  }

  // Check 7: Skin tone (soft check — log only, don't hard-reject)
  const skinTonePercentage = await checkSkinTone(buffer);
  const skinToneOk = skinTonePercentage >= 20;
  // Note: skinToneOk = false is logged but not added to errors
  if (!skinToneOk) {
    logger.warn(
      { skinTonePercentage, expectedHand },
      'Potential glove detected (soft check)',
    );
  }

  const allHardChecksPassed = magicBytesOk && isSharp && brightnessOk;

  return {
    magicBytes: magicBytesOk,
    sharpness: isSharp,
    brightnessOk: !tooDark,
    brightnessTooLight: tooLight,
    skinTone: skinToneOk,
    width,
    height,
    fileSizeBytes: buffer.length,
    contentType,
    allHardChecksPassed,
    errorMessages: errors,
  };
}
