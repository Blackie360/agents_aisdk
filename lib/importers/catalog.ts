import { Format } from "../types/schema";
export const formats: {
  id: Format;
  label: string;
  support: string;
  limits: string;
}[] = [
  {
    id: "postgresql",
    label: "PostgreSQL DDL",
    support:
      "CREATE TABLE, composite keys, foreign-key actions, CHECK expressions, parsed CREATE INDEX definitions, defaults and nullability.",
    limits:
      "REFERENCES requires explicit target columns. No migration execution, views, triggers or policies. Unsupported index syntax and other statements are skipped with warnings. Invalid table syntax, COPY data dumps and unquoted SQL routine bodies fail.",
  },
  {
    id: "mysql",
    label: "MySQL DDL",
    support:
      "CREATE TABLE, backticks, AUTO_INCREMENT, composite keys and foreign keys.",
    limits:
      "No ALTER migrations, engine semantics, generated expressions or index modeling.",
  },
  {
    id: "sqlite",
    label: "SQLite DDL",
    support: "CREATE TABLE, inline/table references and composite keys.",
    limits:
      "No migration evaluation, virtual tables or SQLite affinity/rowid validation.",
  },
  {
    id: "drizzle",
    label: "Drizzle TypeScript",
    support:
      "Static pgTable/mysqlTable/sqliteTable with imported column builders, keys and inline references.",
    limits:
      "No execution, dynamic helpers, extra table config/compound keys, custom types or cross-file resolution. Combine related declarations in one input.",
  },
  {
    id: "prisma",
    label: "Prisma schema",
    support:
      "Relational models, scalar/list fields, enums, explicit relations and compound keys.",
    limits:
      "Implicit relations, mapping/native-type semantics and indexes warn. MongoDB/composite types are rejected.",
  },
  {
    id: "typeorm",
    label: "TypeORM EntitySchema JSON",
    support:
      "JSON EntitySchema options (object or array): columns, primary/unique keys and explicit join columns.",
    limits:
      "No decorators, executable JS/TS, inferred join columns, inheritance or automatic junction tables.",
  },
  {
    id: "json-schema",
    label: "Document JSON Schema",
    support:
      "Object properties, nested objects, arrays, required fields, types and descriptions.",
    limits:
      "Structural document view, not an ERD or full validator. References, composition and validation keywords warn.",
  },
];
export const examples: Record<Format, string> = {
  drizzle: `import { pgTable, integer, text } from 'drizzle-orm/pg-core';
export const teams = pgTable('teams', { id: integer().primaryKey(), name: text().notNull() });
export const members = pgTable('members', { id: integer().primaryKey(), teamId: integer().references(() => teams.id) });`,
  postgresql: `CREATE TABLE teams (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(120) NOT NULL UNIQUE\n);\nCREATE TABLE members (\n  id INTEGER PRIMARY KEY,\n  team_id INTEGER NOT NULL REFERENCES teams(id),\n  email TEXT NOT NULL UNIQUE,\n  joined_at TIMESTAMP DEFAULT now()\n);`,
  mysql:
    "CREATE TABLE teams (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(120) NOT NULL);\nCREATE TABLE members (id INT PRIMARY KEY, team_id INT NOT NULL, FOREIGN KEY (team_id) REFERENCES teams(id));",
  sqlite:
    "CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\nCREATE TABLE members (id INTEGER PRIMARY KEY, team_id INTEGER REFERENCES teams(id), active INTEGER DEFAULT 1);",
  prisma: `model Team {\n  id Int @id\n  name String @unique\n  members Member[]\n}\n\nmodel Member {\n  id Int @id\n  teamId Int\n  email String @unique\n  team Team @relation(fields: [teamId], references: [id])\n}`,
  typeorm: JSON.stringify(
    [
      {
        name: "Team",
        columns: {
          id: { type: "int", primary: true },
          name: { type: "varchar" },
        },
      },
      {
        name: "Member",
        columns: {
          id: { type: "int", primary: true },
          teamId: { type: "int" },
        },
        relations: {
          team: {
            type: "many-to-one",
            target: "Team",
            joinColumn: { name: "teamId", referencedColumnName: "id" },
          },
        },
      },
    ],
    null,
    2,
  ),
  "json-schema": JSON.stringify(
    {
      title: "Customer",
      type: "object",
      required: ["id", "profile"],
      properties: {
        id: { type: "string" },
        profile: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" }, city: { type: "string" } },
        },
        tags: { type: "array", items: { type: "string" } },
      },
    },
    null,
    2,
  ),
};
