import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI } from 'otplib';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@palmresearch.org';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-immediately';
  const totpSecret = process.env.TOTP_SECRET ?? generateSecret();
  const issuer = process.env.TOTP_ISSUER ?? 'Palm Research Platform';

  // Hash password
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Upsert admin user
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      totpSecret,
    },
  });

  console.log('✅ Admin user seeded:', admin.email);
  console.log('');
  console.log('🔐 TOTP Setup:');
  console.log('   Secret:', totpSecret);
  console.log('   Add this to your authenticator app.');
  console.log('   Or use this URL to generate a QR code:');

  const otpauthUrl = generateURI({
    strategy: 'totp',
    issuer,
    label: `${issuer}:${adminEmail}`,
    secret: totpSecret,
  });

  console.log('   ', otpauthUrl);
  console.log('');
  console.log('⚠️  IMPORTANT: Save the TOTP secret in your .env.local as TOTP_SECRET');
  console.log('   TOTP_SECRET=' + totpSecret);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
