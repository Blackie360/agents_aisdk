import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is not defined");
}

const connectionString = process.env.POSTGRES_URL.includes("?")
  ? process.env.POSTGRES_URL
  : `${process.env.POSTGRES_URL}?sslmode=require`;

const client = postgres(connectionString, { max: 1 });
export const db = drizzle(client, { schema });

