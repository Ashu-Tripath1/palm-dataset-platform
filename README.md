# Palm Dataset Collection Platform

A production-ready web platform for collecting a high-quality, validated dataset of palm photographs from human participants. Built for academic AI research investigating the relationship between profession and palm features.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (persisted to localStorage) |
| Camera | react-webcam + MediaPipe Hands |
| Validation | Zod (client + server), react-hook-form |
| Database | Prisma ORM + PostgreSQL (Supabase) |
| Storage | AWS S3 (private bucket) |
| Auth | NextAuth v4 (email + TOTP 2FA) |
| Rate Limiting | Upstash Redis |
| Image Processing | Sharp (server-side) |
| Email | Resend |
| Deployment | Vercel |

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd palm-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in all required values in .env.local
```

See [Environment Variables](#environment-variables) section below.

### 3. Set up the database

```bash
# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Seed admin user (first time only)
npx prisma db seed
```

The seed script will print a TOTP secret — add it to your `.env.local` as `TOTP_SECRET` and scan the printed `otpauth://` URL with your authenticator app (Google Authenticator, Authy, etc.).

### 4. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `NEXTAUTH_URL` | ✅ | Your app URL (e.g. `https://yourapp.vercel.app`) |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ char string (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` | ✅ | Admin user email |
| `ADMIN_PASSWORD` | ✅ | Admin user password (min 8 chars) |
| `TOTP_SECRET` | ✅ | Base32 TOTP secret (output by seed script) |
| `TOTP_ISSUER` | ✅ | App name shown in authenticator app |
| `AWS_ACCESS_KEY_ID` | ✅ | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS IAM secret key |
| `AWS_REGION` | ✅ | S3 bucket region (e.g. `us-east-1`) |
| `S3_BUCKET_NAME` | ✅ | S3 bucket name |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis REST token |
| `RESEND_API_KEY` | ⚪ | Resend API key (for confirmation emails) |
| `RESEND_FROM_EMAIL` | ⚪ | Verified sender email in Resend |
| `RESEARCH_CONTACT_EMAIL` | ⚪ | Email for withdrawal requests |
| `NEXT_PUBLIC_MAX_FILE_SIZE_MB` | ✅ | Max upload size in MB (default: `10`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public app URL |

---

## Deployment — Vercel + Supabase + AWS S3

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy the **PostgreSQL connection string** from Settings → Database → Connection String (URI mode)
3. Set `DATABASE_URL` in your environment

### Step 2: Create AWS S3 Bucket

1. Create an S3 bucket in AWS Console
2. **IMPORTANT: Block ALL public access** (enable all 4 block public access settings)
3. Create an IAM user with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::palm-dataset-images",
      "arn:aws:s3:::palm-dataset-images/*"
    ]
  }]
}
```

4. Generate access keys for the IAM user → set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### Step 3: Create Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com) → Create Database
2. Copy REST URL and REST Token → set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### Step 4: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repo to Vercel and configure environment variables in the Vercel dashboard.

**Important Vercel settings:**
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Add all environment variables from `.env.local`

### Step 5: Run Migrations on Production

```bash
DATABASE_URL="your-production-url" npx prisma migrate deploy
DATABASE_URL="your-production-url" npx prisma db seed
```

---

## Photo Validation Rules

Every uploaded photo must pass all of the following checks:

| # | Check | Method | Threshold | Error |
|---|-------|--------|-----------|-------|
| 1 | Palm occupies ≥50% of frame | MediaPipe (client) | bounding box area / image area ≥ 0.50 | "Move closer" |
| 2 | Only one hand visible | MediaPipe (client) | handCount === 1 | "One hand only" |
| 3 | Palm parallel to camera | MediaPipe landmarks (client) | tilt angle ≤ 30° | "Hold flat" |
| 4 | Correct hand (L/R) | MediaPipe handedness (client) | matches step requirement | "Wrong hand" |
| 5 | Image is sharp | Laplacian variance (Sharp, server) | variance ≥ 100 | "Too blurry" |
| 6 | Image brightness OK | Mean pixel brightness (Sharp, server) | 60 ≤ mean ≤ 240 | "Too dark/bright" |
| 7 | Skin visible (no gloves) | HSL skin hue % (Sharp, server, soft) | ≥ 20% skin pixels | Flag only, no reject |
| 8 | Valid file type | Magic bytes (server) | JPEG or PNG only | "Invalid file type" |

---

## Security

- **EXIF stripping**: Client-side via piexifjs + server-side via Sharp (double-guarantee)
- **S3**: Private bucket, presigned GET URLs with 60-minute expiry (admin only)
- **Rate limiting**: 4 Upstash Redis sliding-window limiters
- **Input validation**: Zod on all API routes
- **CSP headers**: Configured in next.config.js
- **COOP/COEP**: Required for MediaPipe WebAssembly SharedArrayBuffer
- **Session**: JWT in httpOnly cookie (participants, 24h) + NextAuth JWT (admin, 8h)
- **2FA**: TOTP required for all admin logins

---

## Development Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run type-check    # TypeScript type check
npm run lint          # ESLint
npm run test          # Jest unit tests
npm run test:coverage # Tests with coverage report
npm run db:studio     # Prisma Studio (visual DB editor)
npm run db:migrate    # Run pending migrations
npm run db:seed       # Seed admin user
```

---

## Project Structure

```
palm-platform/
├── app/
│   ├── (public)/             # Public participant pages
│   │   ├── page.tsx          # Landing page
│   │   └── participate/
│   │       ├── profile/      # Profile form (Step 1)
│   │       ├── photos/       # 12-step photo wizard (Step 2)
│   │       ├── review/       # Review grid (Step 3)
│   │       └── confirmation/ # Success + reference code
│   ├── admin/                # Admin panel (requires 2FA)
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── submissions/
│   │   └── export/
│   └── api/                  # API routes
├── components/
│   ├── camera/               # MediaPipe + camera capture
│   ├── wizard/               # Photo wizard steps
│   ├── admin/                # Admin UI components
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── validation/           # Zod schemas + Sharp checks
│   ├── env.ts                # Typed env validator
│   ├── db.ts                 # Prisma singleton
│   ├── s3.ts                 # S3 helpers
│   ├── auth.ts               # NextAuth config
│   └── ratelimit.ts          # Upstash rate limiters
├── store/
│   └── wizardStore.ts        # Zustand state
├── prisma/
│   └── schema.prisma         # Database schema
└── __tests__/                # Jest tests
```

---

## Data Withdrawal

Participants can request data deletion by emailing the research team with their **reference code** (shown on the confirmation page and in the confirmation email). Admins can delete a submission via `DELETE /api/participants/[id]` which cascades to S3 + database.

---

## License

This platform was built for academic research. All collected data is subject to the study's IRB approval and participant consent agreement.
