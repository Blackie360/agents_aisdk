import { isUsageEvent } from "@/lib/analytics/events";
import { recordUsage } from "@/lib/analytics/store";
import { sameOrigin } from "@/lib/analytics/auth";
import { readJson } from "@/lib/services/request-body";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  try {
    const event = await readJson(req, 256);
    // Browser events are reports, never trusted server-side explanation counts.
    if (!isUsageEvent(event) || event.kind !== "visualization")
      return new Response(null, { status: 400 });
    const saved = await recordUsage(event);
    return new Response(null, { status: saved ? 204 : 503 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
