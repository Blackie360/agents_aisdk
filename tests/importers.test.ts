import { test } from "node:test";
import assert from "node:assert/strict";
import { importSchema } from "../lib/importers";
import { examples, formats } from "../lib/importers/catalog";
import { mermaid } from "../lib/services/exports";
import { postgresStatements } from "../lib/parsers/postgres-statements";
test("CREATE EXTENSION selects PostgreSQL and preserves vector field dimensions", () => {
  const schema = importSchema(
    "CREATE EXTENSION IF NOT EXISTS vector; CREATE TABLE schema_migrations (version bigint PRIMARY KEY); CREATE TABLE docs (id uuid PRIMARY KEY, embedding vector(1536));",
    "auto",
  );
  assert.equal(schema.metadata.database, "postgresql");
  assert.equal(schema.tables.length, 2);
  assert.equal(schema.tables[1].columns[1].type, "vector (1536)");
  assert.ok(schema.warnings.some((w) => w.includes("create extension")));
  assert.throws(
    () =>
      importSchema(
        "CREATE TABLE x (name TEXT DEFAULT 'CREATE EXTENSION vector');",
        "auto",
      ),
    /ambiguous/,
  );
});
for (const { id } of formats)
  test(`${id}: example imports with explicit model kind`, () => {
    const s = importSchema(examples[id], id);
    assert.equal(s.tables[0].kind, id === "json-schema" ? "document" : "table");
    assert.equal(s.relationships.length, id === "json-schema" ? 0 : 1);
    assert.ok(s.warnings.length);
  });
for (const format of ["postgresql", "mysql", "sqlite"]) {
  test(`${format}: composite FK preserves pairs and does not mark compound members individually unique`, () => {
    const s = importSchema(
      "CREATE TABLE child (x INT NOT NULL, y INT, UNIQUE(x,y), FOREIGN KEY (x,y) REFERENCES parent(a,b)); CREATE TABLE parent (a INT, b INT, PRIMARY KEY(a,b));",
      format,
    );
    assert.deepEqual(s.relationships[0].from.columns, ["x", "y"]);
    assert.deepEqual(s.relationships[0].to.columns, ["a", "b"]);
    assert.equal(s.relationships[0].type, "one-to-one");
    assert.equal(s.tables[0].columns[0].nullable, false);
    assert.equal(s.tables[0].columns[0].unique, false);
  });
  test(`${format}: defaults, inline FK, self-reference, unique and nullability`, () => {
    const s = importSchema(
      "CREATE TABLE people (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES people(id), email TEXT UNIQUE NOT NULL, n INTEGER DEFAULT 0);",
      format,
    );
    assert.equal(s.relationships[0].to.column, "id");
    assert.equal(s.relationships[0].type, "many-to-one");
    assert.equal(s.tables[0].columns[0].nullable, false);
    assert.equal(s.tables[0].columns[2].unique, true);
    assert.equal(s.tables[0].columns[2].nullable, false);
    assert.match(s.tables[0].columns[3].defaultValue!, /^\(?0\)?$/);
  });
}
test("PostgreSQL qualified names remain distinct", () => {
  const s = importSchema(
    "CREATE TABLE a.users(id INT PRIMARY KEY); CREATE TABLE b.users(id INT PRIMARY KEY, a_id INT REFERENCES a.users(id));",
    "postgresql",
  );
  assert.deepEqual(
    s.tables.map((t) => t.id),
    ["a.users", "b.users"],
  );
  assert.equal(s.relationships[0].to.table, "a.users");
});
test("Prisma relation targets field type, not first model with an id", () => {
  const s = importSchema(
    `model Wrong {\n id Int @id\n}\nmodel User {\n id Int @id\n posts Post[]\n}\nmodel Post {\n id Int @id\n authorId Int\n author User @relation(fields: [authorId], references: [id])\n}`,
    "prisma",
  );
  assert.equal(s.relationships[0].to.table, "User");
  assert.equal(s.relationships[0].from.column, "authorId");
  assert.equal(s.relationships[0].to.column, "id");
  assert.equal(
    s.tables[2].columns.some((c) => c.name === "author"),
    false,
  );
});
test("Prisma compound PK and FK", () => {
  const s = importSchema(
    `model Parent {\n a Int\n b Int\n children Child[]\n @@id([a,b])\n}\nmodel Child {\n id Int @id\n x Int\n y Int\n parent Parent @relation(fields: [x,y], references: [a,b])\n}`,
    "prisma",
  );
  assert.deepEqual(s.tables[0].primaryKey, ["a", "b"]);
  assert.deepEqual(s.relationships[0].to.columns, ["a", "b"]);
});
test("Prisma implicit many-to-many warns and MongoDB rejects", () => {
  const s = importSchema(
    "model A {\n id Int @id\n bs B[]\n}\nmodel B {\n id Int @id\n as A[]\n}",
    "prisma",
  );
  assert.equal(s.relationships.length, 0);
  assert.ok(s.warnings.some((w) => w.includes("implicit relation")));
  assert.throws(
    () =>
      importSchema(
        'datasource db {\n provider = "mongodb"\n url = env("URL")\n}\nmodel A {\n id String @id\n}',
        "prisma",
      ),
    /MongoDB/,
  );
});
test("TypeORM explicit columns, nullable and compound unique", () => {
  const s = importSchema(
    JSON.stringify({
      name: "A",
      columns: {
        x: { type: "int", primary: true },
        y: { type: "text", nullable: true },
      },
      uniques: [{ columns: ["x", "y"] }],
    }),
    "typeorm",
  );
  assert.equal(s.tables[0].columns[1].nullable, true);
  assert.equal(s.tables[0].columns[1].unique, false);
});
test("TypeORM executable source fails; unsupported relations warn", () => {
  assert.throws(() => importSchema("new EntitySchema({})", "typeorm"));
  const s = importSchema(
    JSON.stringify({
      name: "A",
      columns: { id: { type: "int" } },
      relations: { bs: { type: "many-to-many", target: "B" } },
    }),
    "typeorm",
  );
  assert.equal(s.relationships.length, 0);
  assert.ok(s.warnings.some((w) => w.includes("relation omitted")));
});
test("Documents preserve nesting and distinguish optional from nullable", () => {
  const s = importSchema(
    JSON.stringify({
      type: "object",
      required: ["a"],
      properties: {
        a: { type: ["string", "null"] },
        b: { type: "object", properties: { c: { type: "number" } } },
        links: { $ref: "#/$defs/A" },
      },
    }),
    "json-schema",
  );
  assert.equal(s.tables[0].columns[0].required, true);
  assert.equal(s.tables[0].columns[0].nullable, true);
  assert.equal(s.tables[0].columns[1].required, false);
  assert.equal(s.tables[0].columns[1].children?.[0].name, "c");
  assert.ok(s.warnings.some((w) => w.includes("$ref")));
  assert.throws(() => mermaid(s), /relational/);
});
test("Invalid, empty, oversized, duplicate and unsupported input fail honestly", () => {
  for (const content of [
    "",
    "not sql",
    "CREATE TABLE a (id int); CREATE TABLE a (id int);",
  ])
    assert.throws(() => importSchema(content, "postgresql"));
  assert.throws(() => importSchema("x".repeat(200001), "prisma"), /limit/);
  assert.throws(() => importSchema("x", "auto"), /ambiguous/);
  assert.throws(
    () => importSchema("DROP TABLE a;", "postgresql"),
    /No supported/,
  );
});
test("Unresolved references and skipped SQL statements produce warnings", () => {
  const s = importSchema(
    "CREATE TABLE a (id INT REFERENCES missing(id)); CREATE INDEX idx ON a(id);",
    "postgresql",
  );
  assert.equal(s.relationships.length, 0);
  assert.ok(s.warnings.some((w) => w.includes("Unresolved")));
  assert.ok(s.warnings.some((w) => w.includes("create index")));
});
test("Unknown FK columns fail instead of creating misleading edges", () => {
  assert.throws(
    () =>
      importSchema(
        "CREATE TABLE a (id INT PRIMARY KEY); CREATE TABLE b (id INT, FOREIGN KEY(id) REFERENCES a(nope));",
        "postgresql",
      ),
    /Unknown foreign key/,
  );
});
test("JSON export is lossless and Mermaid escapes unsafe identifiers", () => {
  const s = importSchema(examples.postgresql, "postgresql");
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  s.tables[0].name = 'unsafe"{}\n click evil';
  const out = mermaid(s);
  assert.ok(out.startsWith("erDiagram"));
  assert.ok(!out.includes("click evil"));
});

test("Automatic detection recognizes Prisma, Drizzle and declarative JSON", () => {
  for (const f of ["prisma", "drizzle", "typeorm", "json-schema"] as const)
    assert.equal(importSchema(examples[f], "auto").metadata.database, f);
  assert.equal(
    importSchema("CREATE TABLE x(id SERIAL PRIMARY KEY);", "auto").metadata
      .database,
    "postgresql",
  );
  assert.equal(
    importSchema("CREATE TABLE x(id INT AUTO_INCREMENT PRIMARY KEY);", "auto")
      .metadata.database,
    "mysql",
  );
  assert.equal(
    importSchema(
      "CREATE TABLE x(id INTEGER PRIMARY KEY AUTOINCREMENT);",
      "auto",
    ).metadata.database,
    "sqlite",
  );
  assert.throws(
    () => importSchema("CREATE TABLE x(id INTEGER);", "auto"),
    /ambiguous/,
  );
});
for (const [core, factory] of [
  ["pg", "pgTable"],
  ["mysql", "mysqlTable"],
  ["sqlite", "sqliteTable"],
])
  test(`Drizzle ${core}: imported aliases, reference and optional fields`, () => {
    const s = importSchema(
      `import { ${factory} as table, ${core === "mysql" ? "int as integer" : "integer"}, text } from 'drizzle-orm/${core}-core'; const a = table('a', { id: integer().primaryKey(), name: text().unique() }); const b = table('b', { id: integer().primaryKey(), aId: integer().notNull().references(() => a.id) });`,
      "drizzle",
    );
    assert.equal(s.relationships[0].to.table, "a");
    assert.equal(s.tables[1].columns[1].nullable, false);
  });
test("Drizzle unsupported dynamic code is not executed and extra config warns", () => {
  const s = importSchema(
    `import { pgTable, integer } from 'drizzle-orm/pg-core'; throw new Error('executed'); const a = pgTable('a', {id: integer().primaryKey(), ...helper()}, () => []);`,
    "drizzle",
  );
  assert.equal(s.tables[0].columns.length, 1);
  assert.ok(s.warnings.some((w) => w.includes("extra table")));
  assert.ok(s.warnings.some((w) => w.includes("spread")));
});
test("SQL detection ignores dialect hints inside literal values", () => {
  assert.throws(
    () =>
      importSchema(
        "CREATE TABLE x (name TEXT DEFAULT 'AUTO_INCREMENT SERIAL');",
        "auto",
      ),
    /ambiguous/,
  );
});

test("PostgreSQL unsupported implicit REFERENCES grammar fails instead of inventing keys", () => {
  assert.throws(
    () =>
      importSchema(
        "CREATE TABLE child (id INT REFERENCES parent); CREATE TABLE parent (id INT PRIMARY KEY);",
        "postgresql",
      ),
    /Syntax error/,
  );
});

test("PostgreSQL trigger and function statements do not discard valid tables", () => {
  const s = importSchema(
    `
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE TABLE tickets (id bigint PRIMARY KEY, local_status text);
    CREATE OR REPLACE FUNCTION enforce_ticket_evidence() RETURNS trigger AS $body$
    BEGIN
      -- These are function content, not schema definitions.
      RAISE NOTICE 'CREATE TABLE fake(id int);';
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
    CREATE TRIGGER ticket_evidence_gate
      BEFORE UPDATE OF local_status ON tickets
      FOR EACH ROW EXECUTE FUNCTION enforce_ticket_evidence();
    CREATE TABLE evidence (id bigint PRIMARY KEY, ticket_id bigint REFERENCES tickets(id), embedding vector(1536));
  `,
    "auto",
  );
  assert.deepEqual(
    s.tables.map((t) => t.name),
    ["tickets", "evidence"],
  );
  assert.equal(s.relationships.length, 1);
  assert.ok(s.warnings.some((w) => w.includes("create trigger")));
  assert.ok(s.warnings.some((w) => w.includes("procedural behavior")));
});

test("PostgreSQL statement boundaries respect quotes, dollar bodies and nested comments", () => {
  const s = importSchema(
    `/* outer ; /* nested ; */ */
    CREATE TABLE "a;b" (id int PRIMARY KEY, note text DEFAULT 'x;''y');
    -- ; CREATE TABLE fake(x int);
    CREATE TABLE b (id int, note text);
  `,
    "postgresql",
  );
  assert.deepEqual(
    s.tables.map((t) => t.name),
    ["a;b", "b"],
  );
  assert.throws(
    () =>
      importSchema(
        "CREATE TABLE x(id int); CREATE TABLE broken (id);",
        "postgresql",
      ),
    /Syntax error/,
  );
  assert.throws(
    () => importSchema("CREATE TABLE x(id int); /* unterminated", "postgresql"),
    /Unterminated/,
  );
  assert.throws(
    () =>
      importSchema(
        "CREATE FUNCTION f() RETURNS void AS $$ unterminated;",
        "postgresql",
      ),
    /Unterminated/,
  );
  assert.throws(
    () =>
      importSchema(
        "CREATE FUNCTION f() RETURNS int LANGUAGE SQL BEGIN ATOMIC CREATE TABLE fake(id int); END;",
        "postgresql",
      ),
    /Unquoted SQL routine/,
  );
});

test("statement scanner keeps escaped strings and dollar content intact", () => {
  assert.equal(postgresStatements("SELECT $$a;b$$; SELECT 'c;d';").length, 2);
  assert.equal(
    postgresStatements(String.raw`SELECT E'a\';b'; CREATE TABLE real(id int);`)
      .length,
    2,
  );
});

test("COPY payloads cannot introduce fake tables or hide later DDL", () => {
  assert.throws(
    () =>
      importSchema(
        "CREATE TABLE real(id int); COPY real FROM STDIN;\nCREATE TABLE fake(id int);\n\\.\nCREATE TABLE later(id int);",
        "postgresql",
      ),
    /COPY FROM STDIN/,
  );
});

test("quoted COPY output text cannot be mistaken for stdin data", () => {
  const schema = importSchema(
    "COPY (SELECT 'from stdin') TO STDOUT; CREATE TABLE real(id int);",
    "postgresql",
  );
  assert.equal(schema.tables.length, 1);
  assert.equal(schema.tables[0].name, "real");
});
