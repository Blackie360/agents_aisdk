/** @type {import('next').NextConfig} */
export default {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.alias["lilconfig$"] = new URL(
        "./lib/services/browser-parser-config.ts",
        import.meta.url,
      ).pathname;
    }
    return config;
  },
  serverExternalPackages: [
    "@mrleebo/prisma-ast",
    "pgsql-ast-parser",
    "node-sql-parser",
  ],
};
