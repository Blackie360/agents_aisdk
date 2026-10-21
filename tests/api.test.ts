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

test("bad API keys read as 'Invalid API key' per provider; model errors stay separate", async () => {
  const savedFetch = globalThis.fetch;
  const savedKey = process.env.XAI_API_KEY;
  const request = (
    provider: string,
    extra: object = { apiKey: "sk-fake123" },
  ) =>
    new Request("http://local", {
      method: "POST",
      body: JSON.stringify({
        provider,
        schema: { tables: [], relationships: [] },
        ...extra,
      }),
    });
  // Shapes the providers return today (abridged); secrets must never be echoed.
  const badKey: [string, string, number, string][] = [
    [
      "xai",
      "xAI",
      400,
      '{"code":"Client specified an invalid argument","error":"Incorrect API key provided: sk***23. You can obtain an API key from https://console.x.ai."}',
    ],
    [
      "gemini",
      "Gemini",
      400,
      '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}',
    ],
    [
      "openai",
      "OpenAI",
      401,
      '{"error":{"message":"Incorrect API key provided: sk-fake123.","type":"invalid_request_error","code":"invalid_api_key"}}',
    ],
    [
      "claude",
      "Claude",
      401,
      '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
    ],
    [
      "kimi",
      "Kimi",
      401,
      '{"error":{"message":"Invalid Authentication","type":"invalid_authentication_error"}}',
    ],
    ["xai", "xAI", 403, '{"error":"The API key sk***23 is blocked."}'],
  ];
  const article: Record<string, string> = {
    xAI: "an",
    OpenAI: "an",
    Gemini: "a",
    Kimi: "a",
    Claude: "a",
  };
  const modelErrors: [string, number, string][] = [
    [
      "xai",
      404,
      '{"error":"The model grok-nope does not exist or your team does not have access to it."}',
    ],
    [
      "openai",
      404,
      '{"error":{"message":"The model `gpt-nope` does not exist","code":"model_not_found"}}',
    ],
    [
      "openai",
      403,
      '{"error":{"message":"You are not allowed to sample from this model"}}',
    ],
    [
      "gemini",
      404,
      '{"error":{"code":404,"message":"models/gemini-nope is not found for API version v1beta","status":"NOT_FOUND"}}',
    ],
  ];
  try {
    for (const [provider, name, status, body] of badKey) {
      globalThis.fetch = async () => new Response(body, { status });
      const response = await explain(request(provider));
      const data = await response.json();
      assert.equal(response.status, 401, `${provider} ${status}`);
      assert.equal(data.code, "AI_INVALID_KEY");
      assert.match(data.message, new RegExp(`^Invalid API key for ${name}\\.`));
      assert.ok(
        data.message.includes(`it is ${article[name]} ${name} key`),
        data.message,
      );
      assert.doesNotMatch(JSON.stringify(data), /sk|console\.x\.ai|x-api-key/);
    }
    for (const [provider, status, body] of modelErrors) {
      globalThis.fetch = async () => new Response(body, { status });
      const response = await explain(
        request(provider, { apiKey: "real-looking-key", model: "some-model" }),
      );
      const data = await response.json();
      assert.equal(response.status, 502, `${provider} ${status}`);
      assert.equal(data.code, "AI_MODEL_REJECTED");
      assert.match(data.message, /rejected the request or model/);
      assert.doesNotMatch(data.message, /Invalid API key/);
    }
    // A rejected *server* key is not the visitor's fault: no "Invalid API key".
    process.env.XAI_API_KEY = "server-test-key";
    globalThis.fetch = async () => new Response(badKey[0][3], { status: 400 });
    const server = await explain(request("xai", {}));
    assert.equal(server.status, 503);
    assert.equal((await server.json()).code, "SERVER_KEY_UNAVAILABLE");
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = savedKey;
  }
});

test("indefinite articles read correctly for every provider name", async () => {
  const { aiProviders, indefiniteArticle } =
    await import("../lib/services/ai-providers");
  const expected: Record<string, string> = {
    xAI: "an",
    Gemini: "a",
    OpenAI: "an",
    Kimi: "a",
    Claude: "a",
  };
  for (const { name } of Object.values(aiProviders))
    assert.equal(indefiniteArticle(name), expected[name], name);
  for (const [word, a] of [
    ["Anthropic", "an"],
    ["LLM", "an"],
    ["Mistral", "a"],
    ["xAI", "an"],
    ["Hugging Face", "a"],
  ])
    assert.equal(indefiniteArticle(word), a, word);
});
