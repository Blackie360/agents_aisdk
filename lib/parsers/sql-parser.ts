import { Schema } from "../types/schema";
import { parsePostgresToSchema } from "./postgres-parser";
import { parseMysqlOrSqliteToSchema } from "./mysql-sqlite-parser";
// AST adapters intentionally keep dialect parsing separate. Never relabel PostgreSQL as MySQL.
export function parseSQLToSchema(
  content: string,
  dialect: "postgresql" | "mysql" | "sqlite" = "postgresql",
): Schema {
  return dialect === "postgresql"
    ? parsePostgresToSchema(content)
    : parseMysqlOrSqliteToSchema(content, dialect);
}
