import { Format, Schema } from "../types/schema";
import { parsePrismaToSchema } from "../parsers/prisma-parser";
import { parseSQLToSchema } from "../parsers/sql-parser";
import { drizzle } from "./drizzle";
import { finalize } from "./model";
import { typeorm, jsonSchema } from "./json";
import { resolveFormat } from "./resolve";
export { MAX_INPUT_BYTES } from "./resolve";
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
  const resolved = resolveFormat(content, format);
  return finalize(importers[resolved](content as string));
}
