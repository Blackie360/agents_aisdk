import { neon } from "@neondatabase/serverless";
import type { UsageEvent, UsageSummary } from "./events";
function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Usage database is not configured.");
  return neon(url, { fetchOptions: { signal: AbortSignal.timeout(2500) } });
}
export async function recordUsage(event: UsageEvent): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const sql = database();
    await sql`INSERT INTO schemamind_usage_events (id, kind, outcome)
      VALUES (${event.id}, ${event.kind}, ${event.outcome}) ON CONFLICT (id) DO NOTHING`;
    return true;
  } catch {
    // Never log database errors: they can contain connection credentials.
    return false;
  }
}
export async function readUsage(): Promise<UsageSummary> {
  const sql = database();
  const [totals, daily, first] = await sql.transaction([
    sql`SELECT kind, outcome, count(*)::int AS count FROM schemamind_usage_events GROUP BY kind, outcome`,
    sql`SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, kind, outcome, count(*)::int AS count
      FROM schemamind_usage_events WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - interval '29 days'
      GROUP BY day, kind, outcome ORDER BY day DESC, kind, outcome`,
    sql`SELECT min(created_at) AS first_event FROM schemamind_usage_events`,
  ]);
  return {
    totals,
    daily,
    firstEvent: first[0]?.first_event ?? null,
  } as UsageSummary;
}
