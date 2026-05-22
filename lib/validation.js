// Server-side image validation
// Magic bytes check + basic size check.
// Heavy lifting is done client-side via MediaPipe.

export function checkMagicBytes(buffer) {
  if (!buffer || buffer.length < 8) return { ok: false, type: null };
  const b = buffer;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ok: true, type: 'jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ok: true, type: 'png' };
  }
  return { ok: false, type: null };
}

export const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12 MB hard limit server-side

export const PHOTO_STEPS = [
  { hand: 'RIGHT', cameraType: 'BACK',  backgroundNumber: 1 },
  { hand: 'RIGHT', cameraType: 'BACK',  backgroundNumber: 2 },
  { hand: 'RIGHT', cameraType: 'BACK',  backgroundNumber: 3 },
  { hand: 'RIGHT', cameraType: 'FRONT', backgroundNumber: 1 },
  { hand: 'RIGHT', cameraType: 'FRONT', backgroundNumber: 2 },
  { hand: 'RIGHT', cameraType: 'FRONT', backgroundNumber: 3 },
  { hand: 'LEFT',  cameraType: 'BACK',  backgroundNumber: 1 },
  { hand: 'LEFT',  cameraType: 'BACK',  backgroundNumber: 2 },
  { hand: 'LEFT',  cameraType: 'BACK',  backgroundNumber: 3 },
  { hand: 'LEFT',  cameraType: 'FRONT', backgroundNumber: 1 },
  { hand: 'LEFT',  cameraType: 'FRONT', backgroundNumber: 2 },
  { hand: 'LEFT',  cameraType: 'FRONT', backgroundNumber: 3 },
];
