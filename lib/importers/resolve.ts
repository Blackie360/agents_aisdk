import { preflight } from "./preflight";
import { detectFormat } from "./detect";
import { Format } from "../types/schema";
export const MAX_INPUT_BYTES = 200_000;
export const FORMATS: readonly Format[] = [
  "postgresql",
  "mysql",
  "sqlite",
  "drizzle",
  "prisma",
  "typeorm",
  "json-schema",
];
/** Validate input and settle the format without loading any parser. */
export function resolveFormat(content: unknown, format: unknown): Format {
  if (typeof content !== "string" || !content.trim())
    throw new Error("Provide non-empty schema text.");
  if (new TextEncoder().encode(content).byteLength > MAX_INPUT_BYTES)
    throw new Error("Schema exceeds the 200 KB import limit.");
  preflight(content);
  if (format === "auto") {
    format = detectFormat(content);
    if (
      !format &&
      !/\bCREATE\s+(?:(?:TEMPORARY|TEMP|UNLOGGED)\s+)?TABLE\b/i.test(content)
    )
      throw new Error(
        "Unrecognized schema. Paste SQL table definitions, Prisma, Drizzle or a supported JSON schema, or select the format manually.",
      );
    if (!format)
      throw new Error(
        "Format is ambiguous. Choose the SQL dialect or schema format above; common SQL is valid in multiple databases.",
      );
  }
  if (typeof format !== "string" || !FORMATS.includes(format as Format))
    throw new Error(
      "Select a supported schema format. SQL dialects are never guessed.",
    );
  return format as Format;
}
