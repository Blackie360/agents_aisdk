import { test } from "node:test";
import assert from "node:assert/strict";
import { examples, formats } from "../lib/importers/catalog";
import { importSchema } from "../lib/importers";
import { lazyImporters } from "../lib/importers/lazy";
import { finalize } from "../lib/importers/model";
import {
  generateDiagram,
  estimateNodeSize,
} from "../lib/services/diagram-generator";
import { showcase } from "../lib/importers/showcase";

test("per-format lazy parsers give the same result as the bundled importer", async () => {
  for (const { id } of formats) {
    const parse = await lazyImporters[id]();
    assert.deepEqual(
      finalize(parse(examples[id])),
      importSchema(examples[id], id),
      id,
    );
  }
});

test("narrow layout: two non-overlapping columns for small schemas only", () => {
  const schema = importSchema(showcase.source, "prisma");
  const { nodes } = generateDiagram(schema, { narrow: true });
  const xs = [...new Set(nodes.map((n) => n.position.x))];
  assert.equal(xs.length, 2);
  const widest = Math.max(
    ...schema.tables.map((t) => estimateNodeSize(t).width),
  );
  assert.ok(xs[1] - xs[0] >= widest, `${xs} vs ${widest}`);
  // Desktop layout is unchanged.
  assert.deepEqual(
    generateDiagram(schema).nodes.map((n) => n.position),
    schema.tables.map((_, i) => ({
      x: (i % 3) * 400,
      y: Math.floor(i / 3) * 440,
    })),
  );
  // Large schemas keep the overview grid on phones too.
  const big = importSchema(
    Array.from(
      { length: 20 },
      (_, i) => `CREATE TABLE t${i} (id INT PRIMARY KEY);`,
    ).join("\n"),
    "postgresql",
  );
  assert.deepEqual(
    generateDiagram(big, { narrow: true }).nodes.map((n) => n.position),
    generateDiagram(big).nodes.map((n) => n.position),
  );
});
