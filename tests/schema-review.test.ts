import { test } from "node:test";
import assert from "node:assert/strict";
import { importSchema } from "../lib/importers";
import { examples, formats } from "../lib/importers/catalog";
import { reviewSchema } from "../lib/review/schema-review";
for (const { id } of formats)
  test(`review ${id} without mutation`, () => {
    const schema = importSchema(examples[id], id);
    const before = JSON.stringify(schema);
    const result = reviewSchema(schema);
    assert.equal(JSON.stringify(schema), before);
    if (id === "json-schema")
      assert.ok(result.every((finding) => !finding.title.includes("key")));
  });
test("reports keyless tables and unproven target uniqueness", () => {
  const schema = importSchema(
    "CREATE TABLE parent (id int); CREATE TABLE child (id int PRIMARY KEY, parent_id int REFERENCES parent(id));",
    "postgresql",
  );
  const findings = reviewSchema(schema);
  assert.ok(
    findings.some(
      (f) => f.table === "parent" && f.title === "No primary key declared",
    ),
  );
  assert.ok(
    findings.some((f) => f.title === "Reference has no declared unique target"),
  );
  assert.ok(
    findings.some(
      (f) => f.title === "Check the foreign-key index" && f.level === "check",
    ),
  );
});
test("composite keys must match the complete target; covering source prefixes suppress index suggestions", () => {
  const schema = importSchema(
    "CREATE TABLE parent (a int, b int, PRIMARY KEY(a,b)); CREATE TABLE child (x int NOT NULL, y int, z int, UNIQUE(x,y,z), FOREIGN KEY(x,y) REFERENCES parent(a,b));",
    "postgresql",
  );
  const findings = reviewSchema(schema);
  assert.ok(findings.some((f) => f.title.includes("mixes optional")));
  assert.ok(
    !findings.some(
      (f) => f.title.includes("unique target") || f.title.includes("index"),
    ),
  );
  schema.relationships[0].to.columns = ["a"];
  assert.ok(
    reviewSchema(schema).some((f) => f.title.includes("unique target")),
  );
});
test("document optional properties get document guidance only", () => {
  const schema = importSchema(
    JSON.stringify({
      title: "Profile",
      type: "object",
      properties: { name: { type: "string" } },
    }),
    "json-schema",
  );
  assert.deepEqual(
    reviewSchema(schema).map((f) => f.title),
    ["No required properties"],
  );
  schema.tables[0].columns[0].required = true;
  assert.deepEqual(reviewSchema(schema), []);
});

test("PostgreSQL indexes, checks and actions survive import and inform review", () => {
  const schema = importSchema(
    `CREATE UNIQUE INDEX parent_key ON parent (id); CREATE TABLE parent (id int); CREATE TABLE child (id int PRIMARY KEY, parent_id int REFERENCES parent(id) ON DELETE CASCADE ON UPDATE RESTRICT, amount int CHECK(amount > 0), CONSTRAINT positive CHECK(id > 0)); CREATE INDEX child_fk ON child (parent_id);`,
    "postgresql",
  );
  assert.equal(schema.tables[0].indexes?.[0].unique, true);
  assert.deepEqual(schema.tables[0].uniqueKeys, [["id"]]);
  assert.equal(schema.tables[1].checks?.length, 2);
  assert.equal(schema.tables[1].checks?.[1].name, "positive");
  assert.match(schema.tables[1].checks![0].expression, /amount/);
  assert.equal(schema.relationships[0].onDelete, "cascade");
  assert.equal(schema.tables[1].columns[1].foreignKey?.onUpdate, "restrict");
  assert.ok(
    !reviewSchema(schema).some(
      (f) => f.title.includes("index") || f.title.includes("unique target"),
    ),
  );
  assert.ok(
    !schema.warnings.some(
      (w) =>
        w.includes("unsupported constraint check") ||
        w.includes("omitted: create index"),
    ),
  );
});
test("partial and expression indexes remain visible but do not prove FK coverage or uniqueness", () => {
  const schema = importSchema(
    `CREATE TABLE parent (id int); CREATE TABLE child (id int PRIMARY KEY, pid int REFERENCES parent(id)); CREATE UNIQUE INDEX partial_key ON parent(id) WHERE id > 0; CREATE INDEX expr_idx ON child((pid + 1)); CREATE INDEX partial_fk ON child(pid) WHERE pid > 0;`,
    "postgresql",
  );
  assert.deepEqual(schema.tables[0].uniqueKeys, []);
  assert.equal(schema.tables[1].indexes?.length, 2);
  assert.equal(schema.tables[1].indexes?.[0].columns[0], null);
  assert.ok(
    reviewSchema(schema).some((f) => f.title.includes("unique target")),
  );
  assert.ok(reviewSchema(schema).some((f) => f.title.includes("index")));
});
test("unresolved index targets and unsupported index syntax warn honestly", () => {
  const schema = importSchema(
    "CREATE TABLE x(id int); CREATE INDEX missing ON absent(id); CREATE INDEX bad ON x USING made_up (id) INCLUDE (id);",
    "postgresql",
  );
  assert.ok(
    schema.warnings.some((w) => w.includes("target table not imported")),
  );
});

test("composite FK coverage accepts reordered leading columns, not gaps or expressions", () => {
  const base =
    "CREATE TABLE parent(a int,b int,PRIMARY KEY(a,b));CREATE TABLE child(id int PRIMARY KEY,a int NOT NULL,b int NOT NULL,z int,FOREIGN KEY(a,b) REFERENCES parent(a,b));";
  for (const [columns, predicate, expected] of [
    ["a,b", "", false],
    ["b,a", "", false],
    ["b,a,z", "", false],
    ["a,z,b", "", true],
    ["z,a,b", "", true],
    ["a,a", "", true],
    ["b,a", " WHERE a > 0", true],
    ["(b+1),a", "", true],
  ] as const) {
    const schema = importSchema(
      `${base} CREATE INDEX fk ON child(${columns})${predicate};`,
      "postgresql",
    );
    assert.equal(
      reviewSchema(schema).some(
        (f) => f.title === "Check the foreign-key index",
      ),
      expected,
      `${columns}${predicate}`,
    );
  }
  const schema = importSchema(base, "postgresql");
  schema.tables[1].uniqueKeys.push(["b", "a", "z"]);
  assert.ok(
    !reviewSchema(schema).some(
      (f) => f.title === "Check the foreign-key index",
    ),
  );
});
test("unresolved references are review warnings in every format that declares them", () => {
  const cases: [string, string][] = [
    [
      "postgresql",
      "CREATE TABLE child (id int PRIMARY KEY, parent_id int REFERENCES missing_parent(id));",
    ],
    [
      "mysql",
      "CREATE TABLE child (id INT PRIMARY KEY, parent_id INT, FOREIGN KEY (parent_id) REFERENCES missing_parent(id));",
    ],
    [
      "typeorm",
      JSON.stringify([
        {
          name: "Member",
          columns: {
            id: { type: "int", primary: true },
            teamId: { type: "int" },
          },
          relations: {
            team: {
              type: "many-to-one",
              target: "Nope",
              joinColumn: { name: "teamId", referencedColumnName: "id" },
            },
          },
        },
      ]),
    ],
  ];
  for (const [format, source] of cases) {
    const schema = importSchema(source, format);
    const findings = reviewSchema(schema).filter(
      (f) => f.title === "Unresolved reference",
    );
    assert.equal(findings.length, 1, format);
    assert.equal(findings[0].level, "warning");
    assert.match(findings[0].detail, /is not in this import/);
    assert.ok(
      schema.warnings.some((w) => w.startsWith("Unresolved reference")),
    );
  }
  // Resolved references are not flagged.
  assert.ok(
    !reviewSchema(importSchema(examples.typeorm, "typeorm")).some(
      (f) => f.title === "Unresolved reference",
    ),
  );
});
