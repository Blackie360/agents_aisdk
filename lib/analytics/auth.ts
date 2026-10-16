import { createHash, timingSafeEqual } from "node:crypto";
export function adminAuthorized(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  const supplied = req.headers.get("authorization");
  if (!expected || expected.length < 8 || !supplied?.startsWith("Bearer "))
    return false;
  const value = supplied.slice(7);
  if (value.length > 512) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(value), digest(expected));
}
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
