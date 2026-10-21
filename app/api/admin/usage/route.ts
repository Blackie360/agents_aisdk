import { currentUser, isAdmin } from "@/lib/auth/server";
import { readUsage } from "@/lib/analytics/store";
import { consume, ipSubject, rules } from "@/lib/security/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (
  body: object,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...headers,
    },
  });
const denied = () =>
  reply(
    {
      code: "SIGN_IN_REQUIRED",
      message: "Sign in with an admin account to view usage.",
    },
    401,
  );
export async function GET(req: Request) {
  // Every attempt counts, before the session is checked.
  const ip = ipSubject(req);
  const limit = await consume([
    { rule: rules.adminBurst(), subject: ip },
    { rule: rules.adminDailyPerIp(), subject: ip },
  ]);
  if (limit.status === "limited")
    return reply(
      { message: "Too many admin attempts. Try again later." },
      429,
      { "Retry-After": String(limit.retryAfter) },
    );
  // Without the shared limiter, fail closed without evaluating the session.
  if (limit.status === "unavailable") return denied();
  const user = await currentUser(req);
  if (!user) return denied();
  if (!isAdmin(user))
    return reply(
      {
        code: "NOT_ADMIN",
        message:
          "This account is not an admin. Sign in with an address listed in ADMIN_EMAILS.",
      },
      403,
    );
  try {
    return reply(await readUsage());
  } catch {
    return reply(
      {
        message:
          "Usage storage is unavailable. Connect DATABASE_URL and apply the usage migration.",
      },
      503,
    );
  }
}
