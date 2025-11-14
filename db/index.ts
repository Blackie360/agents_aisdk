import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  throw new Error("DATABASE_URL or POSTGRES_URL must be defined");
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Configure SSL for Supabase/PostgreSQL
// Supabase requires SSL - let postgres.js handle it based on connection string
const client = postgres(connectionString, {
  max: 1,
  ssl: "require",
  connect_timeout: 30,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });

