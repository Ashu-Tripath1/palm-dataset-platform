import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';

// ============================================================
// Participant Session JWT
// Short-lived token for participants during submission flow
// Stored in httpOnly cookie, expires in 24 hours
// ============================================================

export interface ParticipantSessionPayload {
  participantId: string;
  iat?: number;
  exp?: number;
}

const PARTICIPANT_SESSION_EXPIRY = '24h';

export function signParticipantToken(participantId: string): string {
  return jwt.sign(
    { participantId } satisfies Omit<ParticipantSessionPayload, 'iat' | 'exp'>,
    env.NEXTAUTH_SECRET,
    { expiresIn: PARTICIPANT_SESSION_EXPIRY },
  );
}

export function verifyParticipantToken(
  token: string,
): ParticipantSessionPayload | null {
  try {
    const payload = jwt.verify(
      token,
      env.NEXTAUTH_SECRET,
    ) as ParticipantSessionPayload;
    return payload;
  } catch (error) {
    logger.warn({ error }, 'Invalid participant token');
    return null;
  }
}

// ============================================================
// Extract participant token from request cookie or Authorization header
// ============================================================

export function extractParticipantToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Try cookie
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...vals] = c.trim().split('=');
        return [key.trim(), vals.join('=')];
      }),
    );
    return cookies['palm-session'] ?? null;
  }

  return null;
}

// ============================================================
// Cookie configuration for participant session
// ============================================================

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60, // 24 hours in seconds
  path: '/',
};

export const SESSION_COOKIE_NAME = 'palm-session';
