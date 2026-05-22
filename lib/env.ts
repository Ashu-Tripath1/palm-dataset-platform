import { z } from 'zod';

// ============================================================
// Environment variable schema — all vars validated at startup
// ============================================================

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),

  // Admin
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  TOTP_SECRET: z.string().min(16),
  TOTP_ISSUER: z.string().default('Palm Research Platform'),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string().min(1),
  S3_ENDPOINT_URL: z.string().url().optional(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Email (optional)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEARCH_CONTACT_EMAIL: z.string().email().default('research@palmresearch.org'),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .default(10),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

// Validate env at module load — throws on missing/invalid vars
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      JSON.stringify(parsed.error.format(), null, 2),
    );
    throw new Error('Invalid environment variables. Check .env.local');
  }

  return parsed.data;
}

function validatePublicEnv() {
  const parsed = publicEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error('Invalid public environment variables');
  }
  return parsed.data;
}

// Only validate server env on the server, and skip during build phase
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
const env =
  typeof window === 'undefined' && !isBuildPhase
    ? validateEnv()
    : ({} as ReturnType<typeof validateEnv>);


const publicEnv = validatePublicEnv();

export { env, publicEnv };
export type Env = typeof env;
