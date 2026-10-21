import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neonConfig } from "@neondatabase/serverless";
import { POST as explain } from "../app/api/schema-explanation/route";
import { GET as adminUsage } from "../app/api/admin/usage/route";
import {
  setSessionResolverForTests,
  type SessionUser,
} from "../lib/auth/server";
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
  "ADMIN_EMAILS",
  "ANON_TRIAL_LIMIT",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "RATE_LIMIT_SALT",
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
    if (q.query.includes("SELECT hits FROM schemamind_rate_limits")) {
      const hits = store.get(String(q.params[0]));
      return {
        fields: [{ name: "hits", dataTypeID: 23 }],
        rows: hits === undefined ? [] : [[String(hits)]],
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

test("3: admin endpoint keeps its limiter in front of the session check", async () => {
  const admin: SessionUser = {
    id: "u1",
    email: "felix@example.com",
    emailVerified: true,
  };
  const adminRequest = (ip = "192.0.2.10", signedIn = false) =>
    new Request("https://schema.example/api/admin/usage", {
      headers: {
        "x-real-ip": ip,
        ...(signedIn ? { "x-test-user": "admin" } : {}),
      },
    });
  setSessionResolverForTests(async (req) =>
    req.headers.get("x-test-user") === "admin" ? admin : null,
  );
  try {
    await withEnv(
      {
        DATABASE_URL: DB,
        ADMIN_EMAILS: admin.email,
        RATE_LIMIT_ADMIN_PER_MINUTE: "3",
      },
      async () => {
        for (let i = 0; i < 3; i++)
          assert.equal((await adminUsage(adminRequest())).status, 401);
        // Fourth attempt is refused even with an admin session.
        const limited = await adminUsage(adminRequest("192.0.2.10", true));
        assert.equal(limited.status, 429);
        assert.ok(Number(limited.headers.get("retry-after")) > 0);
        assert.notEqual(
          (await adminUsage(adminRequest("192.0.2.11", true))).status,
          429,
        );
      },
    );
    await withEnv(
      {
        DATABASE_URL: DB,
        ADMIN_EMAILS: admin.email,
        RATE_LIMIT_ADMIN_DAILY_PER_IP: "2",
      },
      async () => {
        await adminUsage(adminRequest());
        await adminUsage(adminRequest());
        assert.equal(
          (await adminUsage(adminRequest("192.0.2.10", true))).status,
          429,
        );
      },
    );
    // Without the shared limiter in production, admin fails closed even for an admin.
    await withEnv(
      { VERCEL_ENV: "production", ADMIN_EMAILS: admin.email },
      async () => {
        assert.equal(
          (await adminUsage(adminRequest("192.0.2.10", true))).status,
          401,
        );
      },
    );
  } finally {
    setSessionResolverForTests(null);
  }
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

test("IPv6 clients are bucketed by /64; IPv4-mapped IPv6 counts as IPv4", async () => {
  const { ipBucket, ipSubject } = await import("../lib/security/rate-limit");
  const subject = (ip: string) =>
    ipSubject(
      new Request("https://schema.example/", { headers: { "x-real-ip": ip } }),
    );
  assert.equal(ipBucket("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(
    ipBucket("2001:0DB8:0001:0002:ffff:ffff:ffff:fffe"),
    "2001:db8:1:2::/64",
  );
  assert.equal(ipBucket("[2001:db8:1:2::9]"), "2001:db8:1:2::/64");
  assert.equal(ipBucket("fe80::1%eth0"), "fe80:0:0:0::/64");
  assert.equal(ipBucket("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(ipBucket("::ffff:cb00:7107"), "203.0.113.7");
  assert.equal(ipBucket("203.0.113.7"), "203.0.113.7");
  await withEnv({ RATE_LIMIT_SALT: "test-salt-value-0123456789" }, async () => {
    assert.equal(
      subject("2001:db8:1:2::1"),
      subject("2001:db8:1:2:ffff:1:2:3"),
    );
    assert.notEqual(subject("2001:db8:1:2::1"), subject("2001:db8:1:3::1"));
    assert.equal(subject("::ffff:203.0.113.7"), subject("203.0.113.7"));
    assert.notEqual(subject("203.0.113.7"), subject("203.0.113.8"));
  });
  // Rotating addresses inside one /64 does not reset the server-key cap.
  await withEnv(
    {
      DATABASE_URL: DB,
      XAI_API_KEY: "server-test-key",
      RATE_LIMIT_SALT: "test-salt-value-0123456789",
      SERVER_KEY_DAILY_PER_IP: "2",
    },
    async ({ calls, queries }) => {
      assert.equal(
        (await explain(explainRequest({}, "2001:db8:5:6::1"))).status,
        200,
      );
      assert.equal(
        (await explain(explainRequest({}, "2001:db8:5:6::2"))).status,
        200,
      );
      assert.equal(
        (await explain(explainRequest({}, "2001:db8:5:6:abcd::3"))).status,
        429,
      );
      assert.equal(
        (await explain(explainRequest({}, "2001:db8:5:7::1"))).status,
        200,
      );
      assert.equal(calls.length, 3);
      assert.ok(!JSON.stringify(queries).includes("2001:db8"));
    },
  );
  // The admin limiter uses the same bucketing.
  await withEnv(
    {
      DATABASE_URL: DB,
      RATE_LIMIT_SALT: "test-salt-value-0123456789",
      RATE_LIMIT_ADMIN_PER_MINUTE: "2",
    },
    async () => {
      const admin = (ip: string) =>
        adminUsage(
          new Request("https://schema.example/api/admin/usage", {
            headers: { authorization: "Bearer guess", "x-real-ip": ip },
          }),
        );
      assert.equal((await admin("2001:db8:9:9::1")).status, 401);
      assert.equal((await admin("2001:db8:9:9::2")).status, 401);
      assert.equal((await admin("2001:db8:9:9::3")).status, 429);
      assert.equal((await admin("2001:db8:9:a::1")).status, 401);
    },
  );
});

test("RATE_LIMIT_SALT keys the IP hash and is required in production", async () => {
  const { ipSubject } = await import("../lib/security/rate-limit");
  const subject = () =>
    ipSubject(
      new Request("https://schema.example/", {
        headers: { "x-real-ip": "203.0.113.7" },
      }),
    );
  let first = "";
  await withEnv({ RATE_LIMIT_SALT: "salt-one-0123456789" }, async () => {
    first = subject();
  });
  await withEnv({ RATE_LIMIT_SALT: "salt-two-0123456789" }, async () => {
    assert.notEqual(subject(), first);
  });
  await withEnv({ RATE_LIMIT_SALT: "salt-one-0123456789" }, async () => {
    assert.equal(subject(), first);
  });
  // Salt missing in production with a configured store: fail closed.
  await withEnv(
    {
      VERCEL_ENV: "production",
      DATABASE_URL: DB,
      XAI_API_KEY: "server-test-key",
      ADMIN_EMAILS: "felix@example.com",
    },
    async ({ calls, queries }) => {
      const response = await explain(explainRequest());
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "SERVER_KEY_UNAVAILABLE");
      assert.equal(calls.length, 0);
      setSessionResolverForTests(async () => ({
        id: "u1",
        email: "felix@example.com",
        emailVerified: true,
      }));
      const admin = await adminUsage(
        new Request("https://schema.example/api/admin/usage"),
      ).finally(() => setSessionResolverForTests(null));
      assert.equal(admin.status, 401);
      assert.ok(
        queries.every((q) => !q.query.includes("schemamind_rate_limits")),
      );
      // Bring-your-own-key still works.
      assert.equal(
        (await explain(explainRequest({ apiKey: PERSONAL_KEY }))).status,
        200,
      );
      // With the salt set, the same production config serves server-key calls.
      process.env.RATE_LIMIT_SALT = "prod-salt-0123456789";
      assert.equal((await explain(explainRequest())).status, 200);
    },
  );
});

test("anonymous visitors get 3 free server-key explanations, then signup_required", async () => {
  const { ipSubject } = await import("../lib/security/rate-limit");
  let user: SessionUser | null = null;
  setSessionResolverForTests(async () => user);
  const req = (extra: object = {}, ip = "198.51.100.40", cookie?: string) =>
    new Request("https://schema.example/api/schema-explanation", {
      method: "POST",
      headers: { "x-real-ip": ip, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({
        schema: { tables: [], relationships: [] },
        ...extra,
      }),
    });
  try {
    await withEnv(
      {
        DATABASE_URL: DB,
        XAI_API_KEY: "server-test-key",
        RATE_LIMIT_SALT: "test-salt-value-0123456789",
        SERVER_KEY_DAILY_PER_IP: "5",
        RATE_LIMIT_EXPLAIN_PER_MINUTE: "100",
        BETTER_AUTH_SECRET: "s".repeat(40),
        GITHUB_CLIENT_ID: "gh-id",
        GITHUB_CLIENT_SECRET: "gh-secret",
      },
      async ({ calls, store }) => {
        for (const left of [2, 1, 0]) {
          const ok = await explain(req());
          assert.equal(ok.status, 200);
          assert.equal(
            ok.headers.get("x-free-explanations-remaining"),
            String(left),
          );
          assert.match(
            ok.headers.get("set-cookie") ?? "",
            new RegExp(
              `^schemamind_trials=${3 - left}; Path=/; Max-Age=\\d+; HttpOnly; SameSite=Lax`,
            ),
          );
        }
        const fourth = await explain(req());
        assert.equal(fourth.status, 401);
        const body = await fourth.json();
        assert.equal(body.error, "signup_required");
        assert.equal(body.code, "SIGNUP_REQUIRED");
        assert.deepEqual(body.providers, ["github"]);
        assert.equal(calls.length, 3); // the provider was not called
        // Trials are counted in the shared store by hashed IP.
        const subject = ipSubject(
          new Request("https://x/", {
            headers: { "x-real-ip": "198.51.100.40" },
          }),
        );
        const trialKey = [...store.keys()].find((k) =>
          k.startsWith(`anon-trial:${subject}:`),
        );
        assert.ok(trialKey);
        assert.equal(store.get(trialKey!), 3);
        // Bring-your-own-key is unchanged: no trial cap.
        assert.equal(
          (await explain(req({ apiKey: PERSONAL_KEY }))).status,
          200,
        );
        // Signed-in users skip the trial cap but keep the per-IP daily cap (5).
        user = { id: "u1", email: "dev@example.com", emailVerified: true };
        const signedIn = await explain(
          req({ provider: "openai", model: "gpt-big" }),
        );
        assert.equal(signedIn.status, 200);
        assert.equal(
          signedIn.headers.get("x-free-explanations-remaining"),
          null,
        );
        assert.equal(signedIn.headers.get("set-cookie"), null);
        // #19 model pinning still applies to signed-in server-key calls.
        assert.equal(calls.at(-1)!.url, "https://api.x.ai/v1/responses");
        assert.equal(calls.at(-1)!.body.model, "grok-4.7");
        assert.equal((await explain(req())).status, 200);
        const capped = await explain(req());
        assert.equal(capped.status, 429);
        assert.equal((await capped.json()).code, "SERVER_KEY_LIMIT");
        user = null;
        // The cookie is a secondary signal: a used-up browser on a fresh IP is still asked to sign up.
        const viaCookie = await explain(
          req({}, "198.51.100.41", "theme=dark; schemamind_trials=3"),
        );
        assert.equal(viaCookie.status, 401);
        assert.equal((await viaCookie.json()).error, "signup_required");
        // A fresh IP without the cookie starts at zero.
        assert.equal((await explain(req({}, "198.51.100.42"))).status, 200);
      },
    );
    // A request refused by a daily cap does not burn a trial.
    await withEnv(
      {
        DATABASE_URL: DB,
        XAI_API_KEY: "server-test-key",
        RATE_LIMIT_SALT: "test-salt-value-0123456789",
        SERVER_KEY_DAILY_PER_IP: "1",
        ANON_TRIAL_LIMIT: "2",
      },
      async ({ store }) => {
        assert.equal((await explain(req({}, "198.51.100.50"))).status, 200);
        assert.equal((await explain(req({}, "198.51.100.50"))).status, 429);
        const trial = [...store.entries()].filter(([k]) =>
          k.startsWith("anon-trial:"),
        );
        assert.deepEqual(
          trial.map(([, v]) => v),
          [1],
        );
        // Configured limit is honoured and reported.
        const body = await (
          await explain(req({}, "198.51.100.51", "schemamind_trials=2"))
        ).json();
        assert.equal(body.error, "signup_required");
        assert.match(body.message, /2 free explanations/);
        assert.deepEqual(body.providers, []); // auth not configured
      },
    );
    // The trial counter needs the shared store: fail closed in production.
    await withEnv(
      {
        VERCEL_ENV: "production",
        XAI_API_KEY: "server-test-key",
        RATE_LIMIT_SALT: "s".repeat(20),
      },
      async ({ calls }) => {
        assert.equal((await explain(req())).status, 503);
        assert.equal(calls.length, 0);
      },
    );
  } finally {
    setSessionResolverForTests(null);
  }
});

test("auth is enabled only when safely configured; providers shown only when set", async () => {
  const { authEnabled, configuredProviders } =
    await import("../lib/auth/server");
  const { GET: account } = await import("../app/api/account/route");
  const { GET: authGet, POST: authPost } =
    await import("../app/api/auth/[...all]/route");
  const providers = async () =>
    (
      await (
        await account(new Request("https://schema.example/api/account"))
      ).json()
    ).providers;
  const full = {
    DATABASE_URL: DB,
    BETTER_AUTH_SECRET: "s".repeat(32),
    GOOGLE_CLIENT_ID: "g-id",
    GOOGLE_CLIENT_SECRET: "g-secret",
  };
  await withEnv({}, async () => {
    assert.equal(authEnabled(), false);
    assert.deepEqual(await providers(), []);
    const res = await authPost(
      new Request("https://schema.example/api/auth/sign-in/social", {
        method: "POST",
        body: "{}",
      }),
    );
    assert.equal(res.status, 503);
    assert.equal(
      (
        await authGet(
          new Request("https://schema.example/api/auth/get-session"),
        )
      ).status,
      503,
    );
  });
  await withEnv(full, async () => {
    assert.equal(authEnabled(), true);
    assert.deepEqual(configuredProviders(), ["google"]);
    assert.deepEqual(await providers(), ["google"]);
    process.env.GITHUB_CLIENT_ID = "gh-id"; // secret missing: GitHub stays hidden
    assert.deepEqual(await providers(), ["google"]);
    process.env.GITHUB_CLIENT_SECRET = "gh-secret";
    assert.deepEqual(await providers(), ["google", "github"]);
  });
  await withEnv({ ...full, BETTER_AUTH_SECRET: "short-secret" }, async () => {
    assert.equal(authEnabled(), false);
  });
  await withEnv({ ...full, DATABASE_URL: "" }, async () => {
    assert.equal(authEnabled(), false);
  });
  await withEnv({ ...full, GOOGLE_CLIENT_SECRET: "" }, async () => {
    assert.equal(authEnabled(), false); // no provider configured
  });
  // Production also requires BETTER_AUTH_URL.
  await withEnv({ ...full, VERCEL_ENV: "production" }, async () => {
    assert.equal(authEnabled(), false);
    assert.deepEqual(await providers(), []);
    process.env.BETTER_AUTH_URL = "https://schema.example";
    assert.equal(authEnabled(), true);
  });
});

test("Better Auth builds Google and GitHub sign-in URLs with the expected callbacks", async () => {
  const { getAuth, setAuthDatabaseForTests } =
    await import("../lib/auth/server");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  setAuthDatabaseForTests(() =>
    memoryAdapter({
      schemamind_auth_user: [],
      schemamind_auth_session: [],
      schemamind_auth_account: [],
      schemamind_auth_verification: [],
    }),
  );
  await withEnv(
    {
      DATABASE_URL: DB,
      BETTER_AUTH_SECRET: "s".repeat(40),
      BETTER_AUTH_URL: "https://schema.example",
      GOOGLE_CLIENT_ID: "g-id",
      GOOGLE_CLIENT_SECRET: "g-secret",
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
    },
    async () => {
      const auth = getAuth()!;
      assert.ok(auth);
      for (const provider of ["google", "github"]) {
        const res = await auth.handler(
          new Request("https://schema.example/api/auth/sign-in/social", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://schema.example",
            },
            body: JSON.stringify({ provider, callbackURL: "/admin" }),
          }),
        );
        assert.equal(res.status, 200, provider);
        const url = new URL((await res.json()).url);
        assert.equal(
          url.searchParams.get("redirect_uri"),
          `https://schema.example/api/auth/callback/${provider}`,
        );
        if (provider === "github")
          assert.ok(
            url.searchParams.get("scope")!.split(" ").includes("user:email"),
          );
        else
          assert.ok(
            url.searchParams.get("scope")!.split(" ").includes("email"),
          );
      }
      // Email/password is disabled.
      const res = await auth.handler(
        new Request("https://schema.example/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://schema.example",
          },
          body: JSON.stringify({
            email: "a@example.com",
            password: "x".repeat(20),
            name: "a",
          }),
        }),
      );
      assert.ok(res.status >= 400);
    },
  ).finally(() => setAuthDatabaseForTests(null));
});
