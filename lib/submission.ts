import crypto from 'crypto';

// ============================================================
// Submission Duplicate Detection
// Hashes (age + gender + profession + country) to detect
// participants who submit multiple times
// ============================================================

export function buildSubmissionHash(
  age: number,
  gender: string,
  profession: string,
  country: string,
): string {
  const normalized = [
    String(age),
    gender.toLowerCase(),
    profession.toLowerCase().trim(),
    country.toUpperCase(),
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ============================================================
// Generate a human-readable reference code
// Format: PALM-XXXXXXXX (8 random alphanumeric chars)
// ============================================================

export function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous chars
  let code = 'PALM-';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================================================
// Build step key from wizard step parameters
// ============================================================

export type WizardStep = {
  hand: 'LEFT' | 'RIGHT';
  cameraType: 'FRONT' | 'BACK';
  backgroundNumber: 1 | 2 | 3;
};

export const WIZARD_STEPS: WizardStep[] = [
  { hand: 'RIGHT', cameraType: 'BACK', backgroundNumber: 1 },
  { hand: 'RIGHT', cameraType: 'BACK', backgroundNumber: 2 },
  { hand: 'RIGHT', cameraType: 'BACK', backgroundNumber: 3 },
  { hand: 'RIGHT', cameraType: 'FRONT', backgroundNumber: 1 },
  { hand: 'RIGHT', cameraType: 'FRONT', backgroundNumber: 2 },
  { hand: 'RIGHT', cameraType: 'FRONT', backgroundNumber: 3 },
  { hand: 'LEFT', cameraType: 'BACK', backgroundNumber: 1 },
  { hand: 'LEFT', cameraType: 'BACK', backgroundNumber: 2 },
  { hand: 'LEFT', cameraType: 'BACK', backgroundNumber: 3 },
  { hand: 'LEFT', cameraType: 'FRONT', backgroundNumber: 1 },
  { hand: 'LEFT', cameraType: 'FRONT', backgroundNumber: 2 },
  { hand: 'LEFT', cameraType: 'FRONT', backgroundNumber: 3 },
];

export const BACKGROUND_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Plain Light Background',
  2: 'Plain Dark Background',
  3: 'Natural / Outdoor Background',
};

export function buildStepKey(step: WizardStep): string {
  return `${step.hand}_${step.cameraType}_${step.backgroundNumber}`;
}

export function getStepLabel(step: WizardStep): string {
  return `${step.hand === 'RIGHT' ? 'Right' : 'Left'} Palm — ${
    step.cameraType === 'BACK' ? 'Back Camera' : 'Front (Selfie) Camera'
  } — ${BACKGROUND_LABELS[step.backgroundNumber]}`;
}
