import { adminAuthorized } from "@/lib/analytics/auth";
import { readUsage } from "@/lib/analytics/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
export async function GET(req: Request) {
  if (!adminAuthorized(req))
    return reply(
      {
        message:
          "Admin access required. Check your password and server configuration.",
      },
      401,
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
