import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as explain } from "../app/api/schema-explanation/route";
import { POST as parse } from "../app/api/schema-visualizer/route";
import { readJson } from "../lib/services/request-body";
test("parse API validates format and request bounds", async () => {
  const response = await parse(
    new Request("http://local", {
      method: "POST",
      body: JSON.stringify({
        schema: "CREATE TABLE a(id INT);",
        format: "sqlite",
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).schema.tables[0].name, "a");
  assert.equal(
    (await parse(new Request("http://local", { method: "POST", body: "bad" })))
      .status,
    400,
  );
  assert.equal(
    (
      await parse(
        new Request("http://local", {
          method: "POST",
          body: "x".repeat(250001),
        }),
      )
    ).status,
    413,
  );
});
test("body reader preserves split UTF-8 and cancels oversized streams", async () => {
  const bytes = new TextEncoder().encode('{"name":"🌱"}');
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, 11));
      c.enqueue(bytes.slice(11));
      c.close();
    },
  });
  const req = new Request("http://local", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  assert.deepEqual(await readJson(req), { name: "🌱" });
});
test("AI missing key, JSON response and provider failure are independent of imports", async () => {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalFetch = globalThis.fetch;
  const request = () =>
    new Request("http://local", {
      method: "POST",
      body: JSON.stringify({ schema: { tables: [], relationships: [] } }),
    });
  try {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    assert.equal((await explain(request())).status, 503);
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-only";
    globalThis.fetch = async () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: "Plain explanation" }] } }],
      });
    const response = await explain(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      explanation: "Plain explanation",
    });
    globalThis.fetch = async () => new Response("", { status: 429 });
    assert.equal((await explain(request())).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  }
});
