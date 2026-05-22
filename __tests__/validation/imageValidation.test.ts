import { checkMagicBytes, checkSharpness, checkBrightness, checkSkinTone } from '@/lib/validation/imageValidation';
import sharp from 'sharp';

// Helper: create a valid JPEG magic bytes buffer (minimal)
function makeJpegBuffer(): Buffer {
  const buf = Buffer.alloc(10);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

// Helper: create a valid PNG magic bytes buffer (minimal)
function makePngBuffer(): Buffer {
  const buf = Buffer.alloc(10);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

describe('checkMagicBytes', () => {
  test('detects JPEG magic bytes', () => {
    const result = checkMagicBytes(makeJpegBuffer());
    expect(result.valid).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
  });

  test('detects PNG magic bytes', () => {
    const result = checkMagicBytes(makePngBuffer());
    expect(result.valid).toBe(true);
    expect(result.contentType).toBe('image/png');
  });

  test('rejects random bytes', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const result = checkMagicBytes(buf);
    expect(result.valid).toBe(false);
    expect(result.contentType).toBeNull();
  });

  test('rejects empty buffer', () => {
    const result = checkMagicBytes(Buffer.alloc(0));
    expect(result.valid).toBe(false);
  });

  test('rejects buffer that is too short', () => {
    const result = checkMagicBytes(Buffer.from([0xff, 0xd8]));
    expect(result.valid).toBe(false);
  });

  test('rejects PDF magic bytes', () => {
    // PDF starts with %PDF (25 50 44 46)
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    const result = checkMagicBytes(buf);
    expect(result.valid).toBe(false);
  });
});

describe('checkSharpness', () => {
  test('sharp checkerboard image has high variance', async () => {
    // Create a checkerboard image — should be sharp
    const width = 100;
    const height = 100;
    const data = Buffer.alloc(width * height * 3);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 3;
        const val = (x + y) % 2 === 0 ? 255 : 0;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
    }

    const buffer = await sharp(data, { raw: { width, height, channels: 3 } })
      .jpeg()
      .toBuffer();

    const variance = await checkSharpness(buffer);
    expect(variance).toBeGreaterThan(100);
  });

  test('uniform gray image has low variance (blurry)', async () => {
    // Solid gray — no edges = blurry
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .jpeg()
      .toBuffer();

    const variance = await checkSharpness(buffer);
    expect(variance).toBeLessThan(100);
  });
});

describe('checkBrightness', () => {
  test('black image is too dark', async () => {
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const { mean, tooDark, tooLight } = await checkBrightness(buffer);
    expect(mean).toBeLessThan(60);
    expect(tooDark).toBe(true);
    expect(tooLight).toBe(false);
  });

  test('white image is overexposed', async () => {
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .jpeg()
      .toBuffer();

    const { mean, tooDark, tooLight } = await checkBrightness(buffer);
    expect(mean).toBeGreaterThan(240);
    expect(tooDark).toBe(false);
    expect(tooLight).toBe(true);
  });

  test('mid-gray image passes brightness check', async () => {
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    })
      .jpeg()
      .toBuffer();

    const { tooDark, tooLight } = await checkBrightness(buffer);
    expect(tooDark).toBe(false);
    expect(tooLight).toBe(false);
  });
});

describe('checkSkinTone', () => {
  test('returns non-zero for orange/skin-toned image', async () => {
    // Create an image with skin-tone pixels (HSL: H~25°, S>10%, L~50%)
    // RGB approx: r=220, g=170, b=130
    const buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 220, g: 170, b: 130 },
      },
    })
      .jpeg()
      .toBuffer();

    const percentage = await checkSkinTone(buffer);
    // Should detect skin tone pixels
    expect(percentage).toBeGreaterThan(20);
  });

  test('returns low percentage for blue image (non-skin)', async () => {
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const percentage = await checkSkinTone(buffer);
    expect(percentage).toBeLessThan(20);
  });
});
