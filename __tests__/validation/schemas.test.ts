import { participantSchema, photoUploadSchema, adminLoginSchema } from '@/lib/validation/schemas';

describe('participantSchema', () => {
  const validData = {
    age: 30,
    gender: 'MALE' as const,
    profession: 'Software Engineer',
    country: 'IN',
    consentGiven: true,
  };

  test('accepts valid participant data', () => {
    const result = participantSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('rejects age below 18', () => {
    const result = participantSchema.safeParse({ ...validData, age: 17 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.age).toBeDefined();
    }
  });

  test('rejects age above 120', () => {
    const result = participantSchema.safeParse({ ...validData, age: 121 });
    expect(result.success).toBe(false);
  });

  test('rejects missing consent', () => {
    const result = participantSchema.safeParse({ ...validData, consentGiven: false });
    expect(result.success).toBe(false);
  });

  test('rejects invalid country code', () => {
    const result = participantSchema.safeParse({ ...validData, country: 'INDIA' });
    expect(result.success).toBe(false);
  });

  test('accepts country code IN', () => {
    const result = participantSchema.safeParse({ ...validData, country: 'IN' });
    expect(result.success).toBe(true);
  });

  test('strips HTML from profession', () => {
    const result = participantSchema.safeParse({
      ...validData,
      profession: '<script>alert("xss")</script>Engineer',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profession).not.toContain('<script>');
    }
  });

  test('rejects profession shorter than 2 chars', () => {
    const result = participantSchema.safeParse({ ...validData, profession: 'A' });
    expect(result.success).toBe(false);
  });

  test('accepts optional email when empty string', () => {
    const result = participantSchema.safeParse({ ...validData, email: '' });
    expect(result.success).toBe(true);
  });

  test('rejects invalid email format', () => {
    const result = participantSchema.safeParse({ ...validData, email: 'notanemail' });
    expect(result.success).toBe(false);
  });

  test('accepts valid email', () => {
    const result = participantSchema.safeParse({ ...validData, email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  test('accepts all gender values', () => {
    for (const gender of ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const) {
      const result = participantSchema.safeParse({ ...validData, gender });
      expect(result.success).toBe(true);
    }
  });
});

describe('photoUploadSchema', () => {
  const validData = {
    participantId: '550e8400-e29b-41d4-a716-446655440000',
    hand: 'LEFT' as const,
    cameraType: 'BACK' as const,
    backgroundNumber: 1,
  };

  test('accepts valid photo metadata', () => {
    const result = photoUploadSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('rejects invalid UUID', () => {
    const result = photoUploadSchema.safeParse({ ...validData, participantId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  test('rejects background number 0', () => {
    const result = photoUploadSchema.safeParse({ ...validData, backgroundNumber: 0 });
    expect(result.success).toBe(false);
  });

  test('rejects background number 4', () => {
    const result = photoUploadSchema.safeParse({ ...validData, backgroundNumber: 4 });
    expect(result.success).toBe(false);
  });

  test('accepts background numbers 1, 2, 3', () => {
    for (const n of [1, 2, 3]) {
      const result = photoUploadSchema.safeParse({ ...validData, backgroundNumber: n });
      expect(result.success).toBe(true);
    }
  });

  test('rejects invalid hand value', () => {
    const result = photoUploadSchema.safeParse({ ...validData, hand: 'BOTH' });
    expect(result.success).toBe(false);
  });
});

describe('adminLoginSchema', () => {
  test('accepts valid admin credentials', () => {
    const result = adminLoginSchema.safeParse({
      email: 'admin@research.org',
      password: 'secure123',
      totpCode: '123456',
    });
    expect(result.success).toBe(true);
  });

  test('rejects invalid email', () => {
    const result = adminLoginSchema.safeParse({
      email: 'notanemail',
      password: 'secure123',
    });
    expect(result.success).toBe(false);
  });

  test('rejects TOTP code shorter than 6 digits', () => {
    const result = adminLoginSchema.safeParse({
      email: 'admin@research.org',
      password: 'secure123',
      totpCode: '12345',
    });
    expect(result.success).toBe(false);
  });

  test('rejects non-numeric TOTP code', () => {
    const result = adminLoginSchema.safeParse({
      email: 'admin@research.org',
      password: 'secure123',
      totpCode: 'ABCDEF',
    });
    expect(result.success).toBe(false);
  });
});
