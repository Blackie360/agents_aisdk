import { Format, Schema } from "../types/schema";
type Importer = (text: string) => Schema;
// One chunk per parser so the browser downloads only what the input needs
// (TypeScript for Drizzle and node-sql-parser for MySQL/SQLite are megabytes).
export const lazyImporters: Record<Format, () => Promise<Importer>> = {
  postgresql: () =>
    import("../parsers/postgres-parser").then((m) => m.parsePostgresToSchema),
  mysql: () =>
    import("../parsers/mysql-sqlite-parser").then(
      (m) => (text: string) => m.parseMysqlOrSqliteToSchema(text, "mysql"),
    ),
  sqlite: () =>
    import("../parsers/mysql-sqlite-parser").then(
      (m) => (text: string) => m.parseMysqlOrSqliteToSchema(text, "sqlite"),
    ),
  drizzle: () => import("./drizzle").then((m) => m.drizzle),
  prisma: () =>
    import("../parsers/prisma-parser").then((m) => m.parsePrismaToSchema),
  typeorm: () => import("./json").then((m) => m.typeorm),
  "json-schema": () => import("./json").then((m) => m.jsonSchema),
};
