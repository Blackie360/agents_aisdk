import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { existsSync } from "fs";

// Only load .env files in local development (not in Vercel/production)
// In production, environment variables are already available via process.env
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const envPath = existsSync(".env.local") ? ".env.local" : ".env";
  if (existsSync(envPath)) {
    config({
      path: envPath,
    });
  }
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./lib/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
