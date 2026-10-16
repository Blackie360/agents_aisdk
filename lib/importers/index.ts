import { Format, Schema } from "../types/schema";
import { parsePrismaToSchema } from "../parsers/prisma-parser";
import { parseSQLToSchema } from "../parsers/sql-parser";
import { drizzle } from "./drizzle";
import { detectFormat } from "./detect";
import { finalize } from "./model";
import { typeorm, jsonSchema } from "./json";
export const MAX_INPUT_BYTES = 200_000;
export const importers: Record<Format, (text: string) => Schema> = {
  postgresql: (text) => parseSQLToSchema(text, "postgresql"),
  mysql: (text) => parseSQLToSchema(text, "mysql"),
  sqlite: (text) => parseSQLToSchema(text, "sqlite"),
  drizzle,
  prisma: parsePrismaToSchema,
  typeorm,
  "json-schema": jsonSchema,
};
export function importSchema(content: unknown, format: unknown): Schema {
  if (typeof content !== "string" || !content.trim())
    throw new Error("Provide non-empty schema text.");
  if (new TextEncoder().encode(content).byteLength > MAX_INPUT_BYTES)
    throw new Error("Schema exceeds the 200 KB import limit.");
  if (format === "auto") {
    format = detectFormat(content);
    if (!format)
      throw new Error(
        "Format is ambiguous. Choose the SQL dialect or schema format above; common SQL is valid in multiple databases.",
      );
  }
  if (typeof format !== "string" || !Object.hasOwn(importers, format))
    throw new Error(
      "Select a supported schema format. SQL dialects are never guessed.",
    );
  return finalize(importers[format as Format](content));
}
