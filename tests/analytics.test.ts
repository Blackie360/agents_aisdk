import { test } from "node:test";
import assert from "node:assert/strict";
import { isUsageEvent } from "../lib/analytics/events";
import { adminAuthorized } from "../lib/analytics/auth";
import { GET } from "../app/api/admin/usage/route";
import { POST } from "../app/api/usage/route";
const event = {
  id: "1b643520-13b9-4f68-85e1-09d9473fc457",
  kind: "visualization",
  outcome: "success",
};
test("usage allows bounded metadata only, never schema contents", () => {
  assert.equal(isUsageEvent(event), true);
  for (const bad of [
    null,
    { ...event, schema: "private" },
    { ...event, id: "bad" },
    { ...event, kind: "sql" },
    { ...event, outcome: "maybe" },
  ])
    assert.equal(isUsageEvent(bad), false);
});
test("admin fails closed without a valid configured password, and protects data", async () => {
  const old = process.env.ADMIN_PASSWORD;
  const db = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_PASSWORD;
    const request = (key: string) =>
      new Request("https://example.com/api/admin/usage", {
        headers: { authorization: `Bearer ${key}` },
      });
    assert.equal(adminAuthorized(request("")), false);
    process.env.ADMIN_PASSWORD = "short";
    assert.equal(adminAuthorized(request("short")), false);
    process.env.ADMIN_PASSWORD = "fifteen-chars-x";
    assert.equal(adminAuthorized(request("fifteen-chars-x")), false);
    process.env.ADMIN_PASSWORD = "sixteen-chars-ok";
    assert.equal((await GET(request("wrong"))).status, 401);
    const good = request(process.env.ADMIN_PASSWORD);
    assert.equal(adminAuthorized(good), true);
    const response = await GET(good);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    if (old === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = old;
    if (db === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = db;
  }
});
test("browser telemetry rejects foreign origins, oversized bodies and forged AI events", async () => {
  const req = (body: unknown, origin = "https://example.com") =>
    new Request("https://example.com/api/usage", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(body),
    });
  assert.equal((await POST(req(event, "https://attacker.test"))).status, 403);
  assert.equal(
    (await POST(req({ ...event, kind: "explanation" }))).status,
    400,
  );
  assert.equal(
    (await POST(req({ ...event, extra: "x".repeat(300) }))).status,
    400,
  );
});

test("Neon writes are parameterized, deduplicated and fail open; AI is server counted", async () => {
  const { neonConfig } = await import("@neondatabase/serverless");
  const { recordUsage, readUsage } = await import("../lib/analytics/store");
  const { POST: explain } = await import("../app/api/schema-explanation/route");
  const oldFetch = neonConfig.fetchFunction;
  const oldDb = process.env.DATABASE_URL;
  const oldKey = process.env.XAI_API_KEY;
  const queries: any[] = [];
  try {
    process.env.DATABASE_URL = "postgresql://synthetic@database.invalid/test";
    delete process.env.XAI_API_KEY;
    neonConfig.fetchFunction = async (_url: unknown, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body));
      queries.push(body);
      if (body.queries)
        return Response.json({
          results: [
            {
              fields: [
                { name: "kind", dataTypeID: 25 },
                { name: "outcome", dataTypeID: 25 },
                { name: "count", dataTypeID: 23 },
              ],
              rows: [["explanation", "failure", "1"]],
            },
            { fields: [], rows: [] },
            {
              fields: [{ name: "first_event", dataTypeID: 25 }],
              rows: [["2026-10-16T00:00:00Z"]],
            },
          ],
        });
      return Response.json({ fields: [], rows: [] });
    };
    assert.equal(await recordUsage(event as any), true);
    assert.match(queries[0].query, /ON CONFLICT \(id\) DO NOTHING/);
    assert.deepEqual(queries[0].params, [event.id, "visualization", "success"]);
    const response = await explain(
      new Request("https://example.com/api/schema-explanation", {
        method: "POST",
        body: JSON.stringify({ schema: { tables: [], relationships: [] } }),
      }),
    );
    assert.equal(response.status, 503);
    const usageInsert = queries
      .slice(1)
      .find((q) => String(q.query).includes("schemamind_usage_events"));
    assert.ok(usageInsert);
    assert.equal(usageInsert.params[1], "explanation");
    assert.equal(usageInsert.params[2], "failure");
    assert.equal(JSON.stringify(queries).includes("tables"), false);
    assert.deepEqual((await readUsage()).totals, [
      { kind: "explanation", outcome: "failure", count: 1 },
    ]);
    neonConfig.fetchFunction = async () => {
      throw new Error("private database credentials");
    };
    assert.equal(await recordUsage(event as any), false);
    assert.equal(
      (
        await explain(
          new Request("https://example.com/api/schema-explanation", {
            method: "POST",
            body: JSON.stringify({ schema: { tables: [], relationships: [] } }),
          }),
        )
      ).status,
      503,
    );
  } finally {
    neonConfig.fetchFunction = oldFetch;
    if (oldDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDb;
    if (oldKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = oldKey;
  }
});
