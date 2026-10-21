import { createHmac } from "node:crypto";
import { isIP } from "node:net";
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

/**
 * Normalize a client address to the unit a single client can control:
 * IPv4 as-is, IPv4-mapped IPv6 (::ffff:a.b.c.d) as IPv4, and other IPv6
 * addresses by their /64 prefix (one subscriber typically owns a whole /64,
 * so rotating within it must not reset the limits). Anything unparseable is
 * used verbatim (bounded), which still yields a stable bucket.
 */
export function ipBucket(raw: string): string {
  let ip = raw.trim().slice(0, 100);
  const bracketed = ip.match(/^\[([^\]]+)\]/);
  if (bracketed) ip = bracketed[1];
  ip = ip.replace(/%.*$/, "").toLowerCase(); // drop IPv6 zone ids
  const kind = isIP(ip);
  if (kind === 4) return ip;
  if (kind !== 6) return ip;
  const groups = expandIPv6(ip);
  if (!groups) return ip;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff)
    return [
      groups[6] >> 8,
      groups[6] & 255,
      groups[7] >> 8,
      groups[7] & 255,
    ].join(".");
  return (
    groups
      .slice(0, 4)
      .map((g) => g.toString(16))
      .join(":") + "::/64"
  );
}

function expandIPv6(ip: string): number[] | null {
  let text = ip;
  const tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    text =
      text.slice(0, tail.index) +
      ((a << 8) | b).toString(16) +
      ":" +
      ((c << 8) | d).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0) return null;
  const parts = [...head, ...Array(fill).fill("0"), ...rest];
  if (parts.length !== 8) return null;
  const groups = parts.map((p) => parseInt(p, 16));
  return groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff)
    ? groups
    : null;
}

const DEV_SALT = "schemamind-development-only-salt";

/** Secret used to key IP hashes. Required in production (see consume). */
function salt(): string | undefined {
  const value = process.env.RATE_LIMIT_SALT?.trim();
  if (value) return value;
  return isProduction() ? undefined : DEV_SALT;
}

/** Stable, non-reversible subject for the caller's IP, keyed with the
 * RATE_LIMIT_SALT secret. Vercel overwrites x-real-ip / x-forwarded-for at
 * its edge, so clients cannot spoof them there. */
export function ipSubject(req: Request): string {
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const key = salt();
  // Without a salt in production, consume() refuses every check; the subject
  // is never stored, so its value here does not matter.
  if (!key) return "ip:unsalted";
  return (
    "ip:" +
    createHmac("sha256", key).update(ipBucket(ip)).digest("hex").slice(0, 32)
  );
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL_ENV;
}

/**
 * Count one hit against every check. Returns "unavailable" when the shared
 * store or RATE_LIMIT_SALT is missing in production, or the store errors; callers that spend the
 * server key must then fail closed. Local development without DATABASE_URL
 * is allowed through so the app still runs offline.
 */
export async function consume(
  checks: LimitCheck[],
  now = Date.now(),
): Promise<LimitResult> {
  const url = process.env.DATABASE_URL;
  // A missing salt in production is treated like a missing store: fail closed.
  if (!salt()) return { status: "unavailable" };
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
