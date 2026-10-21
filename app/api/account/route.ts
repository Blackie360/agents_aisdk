import {
  authEnabled,
  configuredProviders,
  currentUser,
  isAdmin,
} from "@/lib/auth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Public sign-in state for the UI: enabled providers and the current user. */
export async function GET(req: Request) {
  const providers = authEnabled() ? configuredProviders() : [];
  const user = await currentUser(req);
  return Response.json(
    {
      providers,
      user: user
        ? {
            name: user.name ?? null,
            email: user.email,
            image: user.image ?? null,
          }
        : null,
      admin: isAdmin(user),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
