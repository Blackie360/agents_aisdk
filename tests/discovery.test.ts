import { test } from "node:test";
import assert from "node:assert/strict";
import { isSchemaCandidate } from "../lib/importers/discovery";
test("Folder discovery excludes dependencies, builds and unrelated files", () => {
  for (const p of [
    "repo/prisma/schema.prisma",
    "repo/drizzle/schema.ts",
    "repo/db/schema/users.ts",
    "repo/database.sql",
    "repo/entities.json",
  ])
    assert.ok(isSchemaCandidate(p), p);
  for (const p of [
    "repo/node_modules/a/schema.ts",
    "repo/.git/file.sql",
    "repo/.next/schema.ts",
    "repo/.env",
    "repo/app/page.tsx",
  ])
    assert.equal(isSchemaCandidate(p), false, p);
});
