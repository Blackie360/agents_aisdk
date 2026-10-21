// Admin access now uses Better Auth sessions (lib/auth/server.ts, ADMIN_EMAILS).
// The former shared ADMIN_PASSWORD gate was removed.
export function sameOrigin(req: Request): boolean {
  try {
    return (
      req.headers.get("origin") === new URL(req.url).origin &&
      req.headers.get("sec-fetch-site") !== "cross-site"
    );
  } catch {
    return false;
  }
}
