import { z } from 'zod';

// ============================================================
// Shared Zod Validation Schemas
// Used both client-side (form validation) and server-side (API routes)
// ============================================================

// --- Participant Profile ---

export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
export const handEnum = z.enum(['LEFT', 'RIGHT']);
export const cameraTypeEnum = z.enum(['FRONT', 'BACK']);
export const submissionStatusEnum = z.enum(['IN_PROGRESS', 'SUBMITTED', 'REJECTED']);

export const participantSchema = z.object({
  age: z
    .number()
    .int('Age must be a whole number')
    .min(18, 'You must be at least 18 years old to participate')
    .max(120, 'Please enter a valid age'),

  gender: genderEnum,

  profession: z
    .string()
    .min(2, 'Profession must be at least 2 characters')
    .max(200, 'Profession must be less than 200 characters')
    // Strip HTML tags
    .transform((val) => val.replace(/<[^>]*>/g, '').trim())
    .refine((val) => val.length >= 2, 'Profession is required'),

  professionCategory: z
    .string()
    .max(200)
    .transform((val) => val.replace(/<[^>]*>/g, '').trim())
    .optional(),

  country: z
    .string()
    .length(2, 'Please select a valid country')
    .regex(/^[A-Z]{2}$/, 'Country must be a 2-letter ISO code'),

  email: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),

  consentGiven: z.boolean().refine((val) => val === true, {
    message: 'You must consent to participate in this study',
  }),
});

// Type exported for use in components
export type ParticipantFormData = z.infer<typeof participantSchema>;

// Server-side schema: age may come as string from JSON
export const participantApiSchema = participantSchema.extend({
  age: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(
      z
        .number()
        .int()
        .min(18, 'You must be at least 18 years old')
        .max(120, 'Please enter a valid age'),
    ),
});

// --- Photo Upload ---

export const photoUploadSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID'),
  hand: handEnum,
  cameraType: cameraTypeEnum,
  backgroundNumber: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().min(1).max(3)),
});

export type PhotoUploadData = z.infer<typeof photoUploadSchema>;

// --- Submission Complete ---

export const submissionCompleteSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID'),
});

// --- Admin Login ---

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z
    .string()
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits')
    .optional(),
});

export type AdminLoginData = z.infer<typeof adminLoginSchema>;

// --- Admin Status Update ---

export const statusUpdateSchema = z.object({
  status: z.enum(['SUBMITTED', 'REJECTED']),
});

// --- Export Filters ---

export const exportFiltersSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: submissionStatusEnum.optional(),
  gender: genderEnum.optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional()
    .default(1),

  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default(20),

  search: z.string().max(200).optional(),
});

export type ExportFilters = z.infer<typeof exportFiltersSchema>;

// --- Validation checks result shape ---

export const validationChecksSchema = z.object({
  magicBytes: z.boolean(),
  palmSize: z.boolean(),
  handCount: z.boolean(),
  palmAngle: z.boolean(),
  handedness: z.boolean(),
  sharpness: z.boolean(),
  brightness: z.boolean(),
  skinTone: z.boolean(), // soft check
});

export type ValidationChecks = z.infer<typeof validationChecksSchema>;
