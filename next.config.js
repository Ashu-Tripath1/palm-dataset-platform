/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prevent webpack from bundling these Node.js server packages
  // (Next.js 14 uses `experimental.serverComponentsExternalPackages`)
  experimental: {
    serverComponentsExternalPackages: ['mongodb', 'jszip', 'jsonwebtoken', 'bcryptjs', 'uuid'],
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

module.exports = nextConfig;
