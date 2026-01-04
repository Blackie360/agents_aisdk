/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [],
  },
  transpilePackages: ['shiki', 'streamdown'],
  serverExternalPackages: [
    '@mrleebo/prisma-ast',
    'pgsql-ast-parser',
    'lilconfig',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mark Node.js modules as external for client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
