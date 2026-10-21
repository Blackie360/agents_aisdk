import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neonConfig } from "@neondatabase/serverless";
import { POST as explain } from "../app/api/schema-explanation/route";
import { GET as adminUsage } from "../app/api/admin/usage/route";
import {
  adminAuthorized,
  ADMIN_PASSWORD_MIN_LENGTH,
} from "../lib/analytics/auth";
import { SCHEMA_LIMITS } from "../lib/security/schema-limits";

const ENV_KEYS = [
  "DATABASE_URL",
  "VERCEL_ENV",
  "XAI_API_KEY",
  "XAI_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "OPENAI_API_KEY",
  "SERVER_AI_PROVIDER",
  "RATE_LIMIT_EXPLAIN_PER_MINUTE",
  "SERVER_KEY_DAILY_PER_IP",
  "SERVER_KEY_DAILY_GLOBAL",
  "RATE_LIMIT_ADMIN_PER_MINUTE",
  "RATE_LIMIT_ADMIN_DAILY_PER_IP",
  "ADMIN_PASSWORD",
];
const PERSONAL_KEY = "sk-personal-SECRET-7f3a9";

/** Runs fn with a clean env, a fake provider fetch and an optional fake Neon. */
async function withEnv(
  env: Record<string, string>,
  fn: (ctx: {
    calls: { url: string; body: any; headers: Headers }[];
    store: Map<string, number>;
    queries: { query: string; params: unknown[] }[];
    setProvider: (f: typeof fetch) => void;
    failStore: (fail: boolean) => void;
  }) => Promise<void>,
) {
  const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const savedFetch = globalThis.fetch;
  const savedNeon = neonConfig.fetchFunction;
  const calls: { url: string; body: any; headers: Headers }[] = [];
  const store = new Map<string, number>();
  const queries: { query: string; params: unknown[] }[] = [];
  let storeFails = false;
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  globalThis.fetch = async (url, options) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(options!.body)),
      headers: new Headers(options!.headers),
    });
    return Response.json({
      status: "completed",
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "Explanation" }] } },
      ],
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Explanation" }],
        },
      ],
    });
  };
  // A single Map shared by every call stands in for the shared Neon table.
  const run = (q: { query: string; params: unknown[] }) => {
    queries.push(q);
    if (q.query.includes("INSERT INTO schemamind_rate_limits")) {
      const bucket = String(q.params[0]);
      const hits = (store.get(bucket) ?? 0) + 1;
      store.set(bucket, hits);
      return {
        fields: [{ name: "hits", dataTypeID: 23 }],
        rows: [[String(hits)]],
      };
    }
    return { fields: [], rows: [] };
  };
  neonConfig.fetchFunction = async (_url: unknown, options?: RequestInit) => {
    if (storeFails)
      throw new Error(`connection failed for ${process.env.DATABASE_URL}`);
    const body = JSON.parse(String(options?.body));
    return Response.json(
      body.queries ? { results: body.queries.map(run) } : run(body),
    );
  };
  try {
    await fn({
      calls,
      store,
      queries,
      setProvider: (f) => (globalThis.fetch = f),
      failStore: (fail) => (storeFails = fail),
    });
  } finally {
    globalThis.fetch = savedFetch;
    neonConfig.fetchFunction = savedNeon;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  }
}

const DB = "postgresql://synthetic@database.invalid/test";
const explainRequest = (
  extra: object = {},
  ip = "203.0.113.1",
  schema?: object,
) =>
  new Request("https://schema.example/api/schema-explanation", {
    method: "POST",
    headers: { "x-real-ip": ip },
    body: JSON.stringify({
      schema: schema ?? { tables: [], relationships: [] },
      ...extra,
    }),
  });

test("1: server key ignores client provider and model; BYO key may choose them", async () => {
  await withEnv({ XAI_API_KEY: "server-test-key" }, async ({ calls }) => {
    for (const extra of [
      {},
      { model: "grok-expensive-reasoning" },
      { provider: "openai", model: "gpt-6-astra-pro" },
      { provider: "not-a-provider", model: "https://evil.example" },
    ]) {
      const response = await explain(explainRequest(extra));
      assert.equal(response.status, 200, JSON.stringify(extra));
      const call = calls.at(-1)!;
      assert.equal(call.url, "https://api.x.ai/v1/responses");
      assert.equal(call.body.model, "grok-4.7");
      assert.equal(call.headers.get("authorization"), "Bearer server-test-key");
    }
    process.env.XAI_MODEL = "grok-pinned";
    await explain(explainRequest({ model: "grok-other" }));
    assert.equal(calls.at(-1)!.body.model, "grok-pinned");
    // Operator can pick the server provider; the client still cannot.
    process.env.SERVER_AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "server-gemini-key";
    await explain(explainRequest({ provider: "xai", model: "grok-4.7" }));
    assert.match(
      calls.at(-1)!.url,
      /generativelanguage\.googleapis\.com\/.*gemini-3\.8-flash/,
    );
    assert.equal(
      calls.at(-1)!.headers.get("x-goog-api-key"),
      "server-gemini-key",
    );
    // A client cannot reach a different server-held key by naming its provider.
    process.env.SERVER_AI_PROVIDER = "xai";
    process.env.OPENAI_API_KEY = "server-openai-key";
    await explain(explainRequest({ provider: "openai" }));
    assert.equal(calls.at(-1)!.url, "https://api.x.ai/v1/responses");
    // BYO key: client choice is honoured and the server key is never used.
    const byo = await explain(
      explainRequest({
        provider: "openai",
        model: "gpt-custom",
        apiKey: PERSONAL_KEY,
      }),
    );
    assert.equal(byo.status, 200);
    assert.equal(calls.at(-1)!.url, "https://api.openai.com/v1/responses");
    assert.equal(calls.at(-1)!.body.model, "gpt-custom");
    assert.equal(
      calls.at(-1)!.headers.get("authorization"),
      `Bearer ${PERSONAL_KEY}`,
    );
    process.env.SERVER_AI_PROVIDER = "bogus";
    assert.equal((await explain(explainRequest())).status, 503);
  });
});

test("2: shared-store burst limit, per-IP and global daily caps on server-key calls", async () => {
  await withEnv(
    {
      DATABASE_URL: DB,
      XAI_API_KEY: "server-test-key",
      RATE_LIMIT_EXPLAIN_PER_MINUTE: "100",
      SERVER_KEY_DAILY_PER_IP: "2",
      SERVER_KEY_DAILY_GLOBAL: "3",
    },
    async ({ calls, store, queries }) => {
      assert.equal(
        (await explain(explainRequest({}, "198.51.100.1"))).status,
        200,
      );
      assert.equal(
        (await explain(explainRequest({}, "198.51.100.1"))).status,
        200,
      );
      const ipCapped = await explain(explainRequest({}, "198.51.100.1"));
      assert.equal(ipCapped.status, 429);
      assert.ok(Number(ipCapped.headers.get("retry-after")) > 0);
      const ipBody = await ipCapped.json();
      assert.equal(ipBody.code, "SERVER_KEY_LIMIT");
      assert.match(ipBody.message, /your own API key/);
      // The capped IP's rejected call did not consume the global allowance.
      assert.equal(
        (await explain(explainRequest({}, "198.51.100.2"))).status,
        200,
      );
      const globalCapped = await explain(explainRequest({}, "198.51.100.3"));
      assert.equal(globalCapped.status, 429);
      assert.match((await globalCapped.json()).message, /your own API key/);
      assert.equal(calls.length, 3);
      // BYO-key calls are not charged against the server-key daily caps.
      const byo = await explain(
        explainRequest({ apiKey: PERSONAL_KEY }, "198.51.100.3"),
      );
      assert.equal(byo.status, 200);
      // Counters live in the database table, keyed by hashed IP (no raw IPs).
      assert.ok(
        [...store.keys()].some((k) =>
          k.startsWith("server-key-global-day:global:"),
        ),
      );
      assert.ok(
        queries.every((q) => !JSON.stringify(q).includes("198.51.100")),
      );
      assert.ok(
        queries.some((q) => /ON CONFLICT \(bucket\) DO UPDATE/.test(q.query)),
      );
    },
  );
  await withEnv(
    {
      DATABASE_URL: DB,
      XAI_API_KEY: "server-test-key",
      RATE_LIMIT_EXPLAIN_PER_MINUTE: "2",
    },
    async ({ calls }) => {
      assert.equal(
        (await explain(explainRequest({ apiKey: PERSONAL_KEY }))).status,
        200,
      );
      assert.equal((await explain(explainRequest())).status, 200);
      const burst = await explain(explainRequest({ apiKey: PERSONAL_KEY }));
      assert.equal(burst.status, 429);
      assert.equal(calls.length, 2);
      assert.equal(
        (await explain(explainRequest({}, "203.0.113.99"))).status,
        200,
      );
    },
  );
});

test("2: server-key path fails closed when the shared store is missing or broken", async () => {
  await withEnv(
    { VERCEL_ENV: "production", XAI_API_KEY: "server-test-key" },
    async ({ calls }) => {
      const response = await explain(explainRequest());
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "SERVER_KEY_UNAVAILABLE");
      assert.equal(calls.length, 0);
      // Bring-your-own-key still works without the store.
      assert.equal(
        (await explain(explainRequest({ apiKey: PERSONAL_KEY }))).status,
        200,
      );
    },
  );
  await withEnv(
    { DATABASE_URL: DB, XAI_API_KEY: "server-test-key" },
    async ({ calls, failStore }) => {
      failStore(true);
      const response = await explain(explainRequest());
      assert.equal(response.status, 503);
      assert.ok(!(await response.text()).includes("database.invalid"));
      assert.equal(calls.length, 0);
    },
  );
});

test("3: admin endpoint is rate limited before the password check and needs 16+ chars", async () => {
  const strong = "a-strong-admin-password-1234";
  const adminRequest = (password: string, ip = "192.0.2.10") =>
    new Request("https://schema.example/api/admin/usage", {
      headers: { authorization: `Bearer ${password}`, "x-real-ip": ip },
    });
  assert.equal(ADMIN_PASSWORD_MIN_LENGTH, 16);
  await withEnv({}, async () => {
    process.env.ADMIN_PASSWORD = "x".repeat(15);
    assert.equal(adminAuthorized(adminRequest("x".repeat(15))), false);
    process.env.ADMIN_PASSWORD = "x".repeat(16);
    assert.equal(adminAuthorized(adminRequest("x".repeat(16))), true);
    assert.equal(adminAuthorized(adminRequest("y".repeat(16))), false);
  });
  assert.match(
    readFileSync("lib/analytics/auth.ts", "utf8"),
    /timingSafeEqual\(/,
  );
  await withEnv(
    {
      DATABASE_URL: DB,
      ADMIN_PASSWORD: strong,
      RATE_LIMIT_ADMIN_PER_MINUTE: "3",
    },
    async () => {
      for (let i = 0; i < 3; i++)
        assert.equal(
          (await adminUsage(adminRequest(`guess-${i}`))).status,
          401,
        );
      // Fourth attempt is refused even with the right password.
      const limited = await adminUsage(adminRequest(strong));
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get("retry-after")) > 0);
      assert.notEqual(
        (await adminUsage(adminRequest(strong, "192.0.2.11"))).status,
        429,
      );
    },
  );
  await withEnv(
    {
      DATABASE_URL: DB,
      ADMIN_PASSWORD: strong,
      RATE_LIMIT_ADMIN_DAILY_PER_IP: "2",
    },
    async () => {
      await adminUsage(adminRequest("guess-a"));
      await adminUsage(adminRequest("guess-b"));
      assert.equal((await adminUsage(adminRequest(strong))).status, 429);
    },
  );
  // Without the shared limiter in production, admin fails closed.
  await withEnv(
    { VERCEL_ENV: "production", ADMIN_PASSWORD: strong },
    async () => {
      assert.equal((await adminUsage(adminRequest(strong))).status, 401);
    },
  );
});

test("4: a personal apiKey is never logged, stored or echoed on any path", async () => {
  const logged: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const saved = methods.map((m) => console[m]);
  methods.forEach(
    (m) =>
      (console[m] = (...args: unknown[]) =>
        void logged.push(args.map(String).join(" "))),
  );
  const bodies: string[] = [];
  const check = async (response: Response) =>
    bodies.push(await response.text());
  try {
    await withEnv(
      { DATABASE_URL: DB, XAI_API_KEY: "server-test-key" },
      async ({ setProvider, queries, failStore }) => {
        await check(await explain(explainRequest({ apiKey: PERSONAL_KEY })));
        for (const status of [400, 401, 403, 404, 429, 500]) {
          setProvider(
            async () => new Response(`echo ${PERSONAL_KEY}`, { status }),
          );
          await check(await explain(explainRequest({ apiKey: PERSONAL_KEY })));
        }
        setProvider(async () => {
          throw new Error(`network error ${PERSONAL_KEY}`);
        });
        await check(await explain(explainRequest({ apiKey: PERSONAL_KEY })));
        setProvider(async () => new Response(`{"broken": "${PERSONAL_KEY}`));
        await check(await explain(explainRequest({ apiKey: PERSONAL_KEY })));
        await check(
          await explain(
            explainRequest({ apiKey: PERSONAL_KEY, model: "bad model!" }),
          ),
        );
        await check(
          await explain(
            explainRequest({ apiKey: PERSONAL_KEY, provider: "nope" }),
          ),
        );
        await check(
          await explain(
            explainRequest({ apiKey: PERSONAL_KEY }, "203.0.113.1", {
              tables: Array.from({ length: SCHEMA_LIMITS.tables + 1 }, () => ({
                columns: [],
              })),
              relationships: [],
            }),
          ),
        );
        await check(
          await explain(
            new Request("https://schema.example/api/schema-explanation", {
              method: "POST",
              body: `{"apiKey":"${PERSONAL_KEY}", broken`,
            }),
          ),
        );
        failStore(true);
        await check(await explain(explainRequest({ apiKey: PERSONAL_KEY })));
        assert.ok(queries.length > 0);
        assert.ok(
          queries.some((q) => q.query.includes("schemamind_usage_events")),
        );
        assert.ok(!JSON.stringify(queries).includes(PERSONAL_KEY));
      },
    );
  } finally {
    methods.forEach((m, i) => (console[m] = saved[i]));
  }
  assert.ok(bodies.length >= 12);
  for (const body of bodies) assert.ok(!body.includes(PERSONAL_KEY), body);
  for (const line of logged) assert.ok(!line.includes(PERSONAL_KEY), line);
});

test("5: schema size is capped by tables, columns and relationships with 413", async () => {
  const table = (columns: number, children = 0) => ({
    name: "t",
    columns: Array.from({ length: columns }, (_, i) => ({
      name: `c${i}`,
      children: Array.from({ length: children }, (_, j) => ({ name: `n${j}` })),
    })),
  });
  await withEnv({ XAI_API_KEY: "server-test-key" }, async ({ calls }) => {
    const over = [
      {
        tables: Array.from({ length: SCHEMA_LIMITS.tables + 1 }, () =>
          table(1),
        ),
        relationships: [],
      },
      { tables: [table(SCHEMA_LIMITS.columnsPerTable + 1)], relationships: [] },
      {
        tables: Array.from({ length: 10 }, () => table(201)),
        relationships: [],
      },
      { tables: [table(100, 2)], relationships: [] }, // 100 + 200 nested = 300 ok
      { tables: [table(101, 2)], relationships: [] }, // 303 with nested children
      {
        tables: [],
        relationships: Array.from(
          { length: SCHEMA_LIMITS.relationships + 1 },
          () => ({}),
        ),
      },
    ];
    const statuses = [];
    for (const schema of over) {
      for (const extra of [{}, { apiKey: PERSONAL_KEY }]) {
        const response = await explain(
          explainRequest(extra, "203.0.113.5", schema),
        );
        statuses.push(response.status);
      }
    }
    assert.deepEqual(
      statuses,
      [413, 413, 413, 413, 413, 413, 200, 200, 413, 413, 413, 413],
    );
    assert.equal(calls.length, 2);
    const atLimit = {
      tables: Array.from({ length: SCHEMA_LIMITS.tables }, () => table(13)),
      relationships: [],
    };
    assert.equal(
      (await explain(explainRequest({}, "203.0.113.5", atLimit))).status,
      200,
    );
  });
});
