/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [],
  },
  transpilePackages: ['shiki', 'streamdown'],
  serverExternalPackages: [],
};

export default nextConfig;
