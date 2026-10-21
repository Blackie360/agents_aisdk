import { test } from "node:test";
import assert from "node:assert/strict";
import { importSchema } from "../lib/importers";
import { importError } from "../lib/importers/preflight";

const shown = (source: string, format: string) => {
  try {
    importSchema(source, format);
  } catch (error) {
    return importError(error);
  }
  throw new Error("expected a syntax error");
};

test("Prisma syntax errors are plain, with line and column (QA bug C)", () => {
  const message = shown("model User { id Int @id\nposts Post[] }", "prisma");
  assert.equal(
    message,
    'Invalid Prisma syntax at line 1, column 14: expected a new line before "id" (each field and block goes on its own line). Check punctuation and the selected format.',
  );
  assert.doesNotMatch(message, /-->|LineBreak|Expecting/);
  assert.match(
    shown("model User {\n  id Int @id\n  name String @@@\n}", "prisma"),
    /^Invalid Prisma syntax at line 3, column 17: unexpected "@"\./,
  );
  assert.match(
    shown("model User {\n  id Int @id\n", "prisma"),
    /^Invalid Prisma syntax at line 3, column 1: unexpected end of input\./,
  );
});

test("MySQL, SQLite and Drizzle syntax errors carry line and column (QA bug D)", () => {
  assert.equal(
    shown(
      "CREATE TABLE a (\n  id INT PRIMARY KEY,\n  name VARCHAR(10) NOT NUL\n);",
      "mysql",
    ),
    'Invalid MySQL syntax at line 3, column 20: unexpected "NOT". Check punctuation and the selected format.',
  );
  assert.equal(
    shown(
      "CREATE TABLE a (\n  id INTEGER PRIMARY KEY,\n  name TEXT,,\n);",
      "sqlite",
    ),
    'Invalid SQLite syntax at line 3, column 13: unexpected ",". Check punctuation and the selected format.',
  );
  assert.match(
    shown("CREATE TABLE a (id INT", "mysql"),
    /^Invalid MySQL syntax at line 1, column 23: unexpected end of input\./,
  );
  assert.equal(
    shown(
      "import { pgTable, integer } from 'drizzle-orm/pg-core';\nexport const a = pgTable('a', {\n  id: integer('id').primaryKey(\n});",
      "drizzle",
    ),
    "Invalid Drizzle TypeScript syntax at line 4, column 1: Argument expression expected. Check punctuation and the selected format.",
  );
});

test("PostgreSQL locations are absolute in multi-statement input", () => {
  assert.match(
    shown(
      "CREATE TABLE a (id INT PRIMARY KEY);\n/* note\n   two lines */\nCREATE TABLE b (\n  id INT,\n  x TEXT NOT NUL\n);",
      "postgresql",
    ),
    /^Invalid PostgreSQL syntax at line 6, column 14: unexpected "nul"\./,
  );
  assert.match(
    shown(
      "CREATE TABLE a (id INT); CREATE TABLE b (id INTT NOT NUL);",
      "postgresql",
    ),
    /^Invalid PostgreSQL syntax at line 1, column 54:/,
  );
});

test("SQL errors name the whole offending token, not one character (QA retest)", () => {
  // QA's case: a missing comma; the parser reports only "n".
  assert.equal(
    shown(
      "CREATE TABLE a (\n  id INTEGER PRIMARY KEY\n  name TEXT\n);",
      "sqlite",
    ),
    'Invalid SQLite syntax at line 3, column 3: unexpected "name". Check punctuation and the selected format.',
  );
  assert.match(
    shown("CREATE TABLE a (id INT DEFAULT 'x' 'y');", "mysql"),
    /unexpected "'y'"/,
  );
  assert.match(
    shown("CREATE TABLE a (id INT 42);", "mysql"),
    /unexpected "42"/,
  );
});
