import { getAuth } from "@/lib/auth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fails closed: when auth is not fully configured, every auth endpoint is 503.
const unavailable = () =>
  Response.json(
    { message: "Sign-in is not configured on this deployment." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
async function handle(req: Request) {
  const auth = getAuth();
  return auth ? auth.handler(req) : unavailable();
}
export const GET = handle;
export const POST = handle;
