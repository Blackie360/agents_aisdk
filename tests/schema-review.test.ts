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
