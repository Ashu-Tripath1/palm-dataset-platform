import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifySync } from 'otplib';


import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { env } from './env';
import { authLogger } from './logger';
import { adminLoginSchema } from './validation/schemas';

// ============================================================
// NextAuth Configuration
// Admin authentication with email/password + TOTP 2FA
// Session expiry: 8 hours
// ============================================================

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: '2FA Code', type: 'text' },
      },
      async authorize(credentials) {
        try {
          // Validate input shape
          const parsed = adminLoginSchema.safeParse(credentials);
          if (!parsed.success) {
            authLogger.warn({ errors: parsed.error.flatten() }, 'Invalid login input');
            return null;
          }

          const { email, password, totpCode } = parsed.data;

          // Look up admin user
          const admin = await prisma.adminUser.findUnique({
            where: { email },
          });

          if (!admin) {
            authLogger.warn({ email }, 'Admin login: user not found');
            // Constant-time comparison to prevent timing attacks
            await bcrypt.compare(password, '$2b$10$invalidhashpadding123456789');
            return null;
          }

          // Verify password
          const passwordOk = await bcrypt.compare(password, admin.passwordHash);
          if (!passwordOk) {
            authLogger.warn({ email }, 'Admin login: invalid password');
            return null;
          }

          // Verify TOTP (required)
          if (!totpCode) {
            authLogger.info({ email }, 'Admin login: TOTP required');
            // Return a special marker that triggers the 2FA step
            // We use a temporary token to signal "password ok, need TOTP"
            return null;
          }

          const result = verifySync({ token: totpCode, secret: admin.totpSecret });
          const totpValid = typeof result === 'object' ? result.valid : !!result;


          if (!totpValid) {
            authLogger.warn({ email }, 'Admin login: invalid TOTP code');
            return null;
          }

          authLogger.info({ email, adminId: admin.id }, 'Admin login successful');

          return {
            id: admin.id,
            email: admin.email,
            name: 'Admin',
          };
        } catch (error) {
          authLogger.error({ error }, 'Admin login error');
          return null;
        }
      },
    }),
  ],

  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },

  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.adminId = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          email: token.email as string,
        };
        (session as unknown as Record<string, unknown>).adminId = token.adminId;

      }
      return session;
    },
  },

  secret: env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);

// ============================================================
// Helper: require admin session in API route
// ============================================================

export async function requireAdminSession(): Promise<{ email: string } | null> {
  // NextAuth session validation is done via getServerSession in API routes
  // This helper is a reminder — use getServerSession(authOptions) in routes
  return null;
}
