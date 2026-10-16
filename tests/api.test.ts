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
test("xAI server fallback, BYOK precedence and private Responses API contract", async () => {
  const originalKey = process.env.XAI_API_KEY;
  const originalFetch = globalThis.fetch;
  const request = (extra: object = {}) =>
    new Request("http://local", {
      method: "POST",
      body: JSON.stringify({
        schema: { tables: [], relationships: [] },
        ...extra,
      }),
    });
  const success = () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Explanation" }],
        },
      ],
    });
  try {
    delete process.env.XAI_API_KEY;
    assert.equal((await explain(request())).status, 503);
    process.env.XAI_API_KEY = "server-test-key";
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://api.x.ai/v1/responses");
      const payload = JSON.parse(options!.body as string);
      assert.equal(payload.store, false);
      assert.equal(payload.model, process.env.XAI_MODEL || "grok-4.7");
      assert.ok(!JSON.stringify(payload).includes("test-key"));
      assert.equal(
        new Headers(options!.headers).get("Authorization"),
        calls === 1 ? "Bearer server-test-key" : "Bearer personal-test-key",
      );
      return success();
    };
    assert.equal((await explain(request())).status, 200);
    const response = await explain(request({ apiKey: "personal-test-key" }));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { explanation: "Explanation" });
    for (const apiKey of ["", "has spaces", 123, null, "a".repeat(513)])
      assert.equal((await explain(request({ apiKey }))).status, 400);
    assert.equal(calls, 2); // Invalid personal keys cannot fall back to the server's key.
    for (const status of [401, 403, 429, 500]) {
      globalThis.fetch = async () =>
        new Response("secret-provider-error", { status });
      const failure = await explain(request({ apiKey: "personal-test-key" }));
      assert.equal(
        failure.status,
        status === 403 ? 401 : status === 500 ? 502 : status,
      );
      assert.ok(!(await failure.text()).includes("secret-provider-error"));
    }
    globalThis.fetch = async () => {
      throw new Error("personal-test-key");
    };
    assert.ok(
      !(
        await (await explain(request({ apiKey: "personal-test-key" }))).text()
      ).includes("personal-test-key"),
    );
    globalThis.fetch = async () =>
      Response.json({ status: "incomplete", output: [] });
    assert.equal((await explain(request())).status, 502);
    const malformed = await explain(
      new Request("http://local", {
        method: "POST",
        body: '{"apiKey":"personal-test-key", broken',
      }),
    );
    assert.ok(!(await malformed.text()).includes("personal-test-key"));
    const crossOrigin = await explain(
      new Request("http://local", {
        method: "POST",
        headers: { Origin: "https://other.example" },
        body: "{}",
      }),
    );
    assert.equal(crossOrigin.status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = originalKey;
  }
});

test("all AI providers route keys correctly, parse responses and sanitize failures", async () => {
  const savedFetch = globalThis.fetch;
  const fixtures = [
    {
      provider: "gemini",
      host: "generativelanguage.googleapis.com",
      header: "x-goog-api-key",
      data: {
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "Explanation" }] },
          },
        ],
      },
    },
    {
      provider: "openai",
      host: "api.openai.com",
      header: "authorization",
      data: {
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Explanation" }],
          },
        ],
      },
    },
    {
      provider: "kimi",
      host: "api.moonshot.ai",
      header: "authorization",
      data: {
        choices: [
          { finish_reason: "stop", message: { content: "Explanation" } },
        ],
      },
    },
    {
      provider: "claude",
      host: "api.anthropic.com",
      header: "x-api-key",
      data: {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Explanation" }],
      },
    },
  ];
  const request = (provider: string, extra = {}) =>
    new Request("http://local", {
      method: "POST",
      body: JSON.stringify({
        provider,
        apiKey: "personal-key",
        schema: { tables: [], relationships: [] },
        ...extra,
      }),
    });
  try {
    for (const fixture of fixtures) {
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(String(url)).hostname, fixture.host);
        assert.equal(
          new Headers(options!.headers).get(fixture.header),
          fixture.header === "authorization"
            ? "Bearer personal-key"
            : "personal-key",
        );
        assert.equal(options!.redirect, "error");
        assert.ok(!String(url).includes("personal-key"));
        assert.ok(!String(options!.body).includes("personal-key"));
        return Response.json(fixture.data);
      };
      assert.deepEqual(
        await (await explain(request(fixture.provider))).json(),
        { explanation: "Explanation" },
      );
      for (const status of [401, 403, 429, 400, 404, 500]) {
        globalThis.fetch = async () =>
          new Response("secret-provider-details", { status });
        const response = await explain(request(fixture.provider));
        const text = await response.text();
        assert.ok(!text.includes("secret-provider-details"));
        assert.ok(!text.includes("personal-key"));
        assert.equal(
          response.status,
          status === 403
            ? 401
            : [400, 404, 500].includes(status)
              ? 502
              : status,
        );
      }
    }
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("should not call");
    };
    assert.equal((await explain(request("unknown"))).status, 400);
    assert.equal(
      (await explain(request("openai", { model: "https://evil.example" })))
        .status,
      400,
    );
    assert.equal(calls, 0);
    globalThis.fetch = async () => {
      throw new DOMException("secret", "TimeoutError");
    };
    assert.match(await (await explain(request("xai"))).text(), /timed out/);
  } finally {
    globalThis.fetch = savedFetch;
  }
});
