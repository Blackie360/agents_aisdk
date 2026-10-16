import { test } from "node:test";
import assert from "node:assert/strict";
import { preflight, importError } from "../lib/importers/preflight";
import { importSchema } from "../lib/importers";
test("3000 SQL tables are rejected before parsing, including in auto mode", () => {
  const sql = Array.from(
    { length: 3000 },
    (_, i) => `CREATE TABLE table_${i} (id INT PRIMARY KEY);`,
  ).join("\n");
  assert.ok(sql.length < 200000);
  const start = performance.now();
  assert.throws(() => preflight(sql), /150 entities/);
  assert.ok(performance.now() - start < 1000);
  assert.throws(() => importSchema(sql, "auto"), /150 entities/);
});
test("quoted DDL, comments and procedural bodies do not inflate table count", () => {
  preflight(
    `CREATE TABLE ok (v text DEFAULT '${"CREATE TABLE nope(id int);".repeat(200)}'); /* CREATE TABLE another(id int); */ CREATE FUNCTION f() RETURNS void AS $$ ${"CREATE TABLE nope(id int);".repeat(200)} $$ LANGUAGE plpgsql;`,
  );
});
test("errors are readable and unresolved references remain explicit", () => {
  assert.equal(
    importError(
      new Error(
        "Syntax error at line 4 col 2: Unexpected kw_current_schema token",
      ),
    ),
    "Invalid schema syntax at line 4, column 2. Check punctuation and the selected format. Some database-specific syntax may be unsupported.",
  );
  assert.throws(
    () => importSchema("hello world }{ ;;;", "auto"),
    /Unrecognized/,
  );
  const schema = importSchema(
    "CREATE TABLE a (id INT, b_id INT REFERENCES nope(id));",
    "postgresql",
  );
  assert.equal(schema.tables[0].columns[1].foreignKey?.unresolved, true);
  assert.ok(schema.warnings.some((w) => w.includes("nope")));
});
