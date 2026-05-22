import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';

// ============================================================
// Upstash Redis Rate Limiters
// ============================================================

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// 5 new participants per IP per hour
export const participantRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: '@palm/participant',
  analytics: true,
});

// 60 photo uploads per IP per hour (allows retakes)
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: '@palm/upload',
  analytics: true,
});

// 3 submission completions per IP per hour
export const submissionRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: '@palm/submission',
  analytics: true,
});

// 10 admin login attempts per IP per 15 minutes
export const adminLoginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: '@palm/admin-login',
  analytics: true,
});

// ============================================================
// Helper: get real IP from Next.js request
// ============================================================

export function getIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; take the first
    return forwarded.split(',')[0].trim();
  }

  return realIp ?? '127.0.0.1';
}
