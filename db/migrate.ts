import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
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

const runMigrate = async () => {
  // Check for POSTGRES_URL or Vercel Postgres environment variables
  const postgresUrl =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL;

  if (!postgresUrl) {
    console.warn(
      "⚠️  POSTGRES_URL is not defined. Skipping migrations.",
      "Make sure POSTGRES_URL is set in your Vercel environment variables.",
    );
    // Don't throw error, just exit gracefully
    // Migrations can be run manually or when the app starts
    process.exit(0);
  }

  // Add connection timeout and retry options
  const connection = postgres(`${postgresUrl}?sslmode=require`, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 20,
  });
  const db = drizzle(connection);

  console.log("⏳ Running migrations...");
  console.log(`Connecting to database: ${postgresUrl.split('@')[1] || '***'}...`);

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/drizzle" });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
