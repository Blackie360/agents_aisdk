import { test } from "node:test";
import assert from "node:assert/strict";
import { importSchema } from "../lib/importers";
import { detectFormat } from "../lib/importers/detect";
import { createPreflightGuard } from "../lib/importers/preflight";
import { showcase } from "../lib/importers/showcase";

test("first-screen Prisma showcase parses cleanly into a connected diagram", () => {
  createPreflightGuard()(showcase.source);
  const schema = importSchema(showcase.source, "prisma");
  assert.deepEqual(
    schema.tables.map((t) => t.name).sort(),
    [...showcase.models].sort(),
  );
  assert.ok(
    schema.relationships.length >= 10,
    String(schema.relationships.length),
  );
  // Only the importer's standing Prisma disclosures; nothing omitted or unresolved.
  assert.ok(schema.warnings.length <= 3, schema.warnings.join("\n"));
  for (const w of schema.warnings)
    assert.doesNotMatch(w, /omit|missing|unresolved|implicit|skipp|reject/i);
  assert.ok(
    schema.tables.every((t) =>
      t.columns.every((c) => !c.foreignKey?.unresolved),
    ),
  );
  const membership = schema.tables.find((t) => t.name === "Membership")!;
  assert.deepEqual(membership.primaryKey, ["userId", "organizationId"]);
  // Auto-detect picks Prisma too, so the default "auto" format works.
  assert.equal(detectFormat(showcase.source), "prisma");
});
