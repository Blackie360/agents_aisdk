import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

// Shared, cross-instance limiter backed by the same Neon database as the usage
// table (DATABASE_URL). Fixed windows: each (rule, subject, window) is one row
// incremented atomically with INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
// Raw IP addresses and request contents are never stored or logged.

export type LimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
};
export type LimitCheck = { rule: LimitRule; subject: string };
export type LimitResult =
  | { status: "ok" }
  | { status: "limited"; rule: string; retryAfter: number }
  | { status: "unavailable" };

const positiveInt = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const DAY = 86_400;

export const rules = {
  explainBurst: (): LimitRule => ({
    name: "explain-burst",
    limit: positiveInt("RATE_LIMIT_EXPLAIN_PER_MINUTE", 5),
    windowSeconds: 60,
  }),
  serverKeyDailyPerIp: (): LimitRule => ({
    name: "server-key-ip-day",
    limit: positiveInt("SERVER_KEY_DAILY_PER_IP", 20),
    windowSeconds: DAY,
  }),
  serverKeyDailyGlobal: (): LimitRule => ({
    name: "server-key-global-day",
    limit: positiveInt("SERVER_KEY_DAILY_GLOBAL", 300),
    windowSeconds: DAY,
  }),
  adminBurst: (): LimitRule => ({
    name: "admin-burst",
    limit: positiveInt("RATE_LIMIT_ADMIN_PER_MINUTE", 5),
    windowSeconds: 60,
  }),
  adminDailyPerIp: (): LimitRule => ({
    name: "admin-ip-day",
    limit: positiveInt("RATE_LIMIT_ADMIN_DAILY_PER_IP", 50),
    windowSeconds: DAY,
  }),
};

export const GLOBAL_SUBJECT = "global";

/** Stable, non-reversible subject for the caller's IP. Vercel overwrites
 * x-real-ip / x-forwarded-for at its edge, so clients cannot spoof them there. */
export function ipSubject(req: Request): string {
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return (
    "ip:" +
    createHash("sha256")
      .update(`schemamind-rate-limit:${ip.slice(0, 100)}`)
      .digest("hex")
      .slice(0, 32)
  );
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL_ENV;
}

/**
 * Count one hit against every check. Returns "unavailable" when the shared
 * store is missing in production or errors anywhere; callers that spend the
 * server key must then fail closed. Local development without DATABASE_URL
 * is allowed through so the app still runs offline.
 */
export async function consume(
  checks: LimitCheck[],
  now = Date.now(),
): Promise<LimitResult> {
  const url = process.env.DATABASE_URL;
  if (!url)
    return isProduction() ? { status: "unavailable" } : { status: "ok" };
  try {
    const sql = neon(url, {
      fetchOptions: { signal: AbortSignal.timeout(2500) },
    });
    const seconds = now / 1000;
    const windows = checks.map(({ rule, subject }) => {
      const start =
        Math.floor(seconds / rule.windowSeconds) * rule.windowSeconds;
      const end = start + rule.windowSeconds;
      return {
        rule,
        bucket: `${rule.name}:${subject}:${start}`,
        expires: new Date(end * 1000).toISOString(),
        retryAfter: Math.max(1, Math.ceil(end - seconds)),
      };
    });
    const results = await sql.transaction(
      windows.map(
        (w) => sql`INSERT INTO schemamind_rate_limits (bucket, hits, expires_at)
          VALUES (${w.bucket}, 1, ${w.expires})
          ON CONFLICT (bucket) DO UPDATE SET hits = schemamind_rate_limits.hits + 1
          RETURNING hits`,
      ),
    );
    if (Math.random() < 0.02)
      await sql`DELETE FROM schemamind_rate_limits WHERE expires_at < now()`.catch(
        () => undefined,
      );
    for (let i = 0; i < windows.length; i++) {
      const hits = Number((results[i] as any)?.[0]?.hits);
      if (!Number.isFinite(hits)) return { status: "unavailable" };
      if (hits > windows[i].rule.limit)
        return {
          status: "limited",
          rule: windows[i].rule.name,
          retryAfter: windows[i].retryAfter,
        };
    }
    return { status: "ok" };
  } catch {
    // Never log store errors: they can contain connection credentials.
    return { status: "unavailable" };
  }
}
