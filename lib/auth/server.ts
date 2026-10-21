import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { isProduction } from "@/lib/security/rate-limit";

// Better Auth with Google and GitHub social sign-in only (no email/password).
// Users live in the same Neon database as usage and rate limits
// (migrations/003_better_auth.sql). The instance is created lazily so builds
// and keyless local development work without any auth configuration.

export type SocialProvider = "google" | "github";
export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
  image?: string | null;
};

const env = (name: string) => process.env[name]?.trim() || undefined;

/** Providers whose client id and secret are both configured. */
export function configuredProviders(): SocialProvider[] {
  const list: SocialProvider[] = [];
  if (env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"))
    list.push("google");
  if (env("GITHUB_CLIENT_ID") && env("GITHUB_CLIENT_SECRET"))
    list.push("github");
  return list;
}

/**
 * Auth is enabled only when it can run safely: a 32+ character secret, the
 * database, at least one provider, and (in production) an explicit
 * BETTER_AUTH_URL. Otherwise sign-in is off and admin access is refused.
 */
export function authEnabled(): boolean {
  const secret = env("BETTER_AUTH_SECRET");
  return (
    !!secret &&
    secret.length >= 32 &&
    !!env("DATABASE_URL") &&
    configuredProviders().length > 0 &&
    (!isProduction() || !!env("BETTER_AUTH_URL"))
  );
}

let cached: { key: string; auth: ReturnType<typeof createAuth> } | null = null;
type Database = Parameters<typeof betterAuth>[0]["database"];
let testDatabase: (() => Database) | null = null;
/** Test seam: use another Better Auth database (pass null to restore). */
export function setAuthDatabaseForTests(factory: (() => Database) | null) {
  testDatabase = factory;
  cached = null;
}

function createAuth() {
  const google =
    env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")
      ? {
          clientId: env("GOOGLE_CLIENT_ID")!,
          clientSecret: env("GOOGLE_CLIENT_SECRET")!,
        }
      : undefined;
  const github =
    env("GITHUB_CLIENT_ID") && env("GITHUB_CLIENT_SECRET")
      ? {
          clientId: env("GITHUB_CLIENT_ID")!,
          clientSecret: env("GITHUB_CLIENT_SECRET")!,
          // Default scopes already include these; kept explicit because admin
          // gating depends on GitHub returning the verified primary email.
          scope: ["read:user", "user:email"],
        }
      : undefined;
  return betterAuth({
    secret: env("BETTER_AUTH_SECRET"),
    baseURL: env("BETTER_AUTH_URL"),
    database: testDatabase
      ? testDatabase()
      : new Pool({
          connectionString: env("DATABASE_URL"),
          max: 3,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 5_000,
        }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      ...(google ? { google } : {}),
      ...(github ? { github } : {}),
    },
    user: { modelName: "schemamind_auth_user" },
    session: { modelName: "schemamind_auth_session" },
    account: { modelName: "schemamind_auth_account" },
    verification: { modelName: "schemamind_auth_verification" },
    telemetry: { enabled: false },
    advanced: { useSecureCookies: isProduction() },
  });
}

/** The Better Auth instance, or null when auth is not (safely) configured. */
export function getAuth() {
  if (!authEnabled()) return null;
  const key = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "DATABASE_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
  ]
    .map((name) => env(name) ?? "")
    .join("\n");
  if (cached?.key !== key) cached = { key, auth: createAuth() };
  return cached.auth;
}

type SessionResolver = (req: Request) => Promise<SessionUser | null>;
let testResolver: SessionResolver | null = null;

/** Test seam: replace session lookup (pass null to restore). */
export function setSessionResolverForTests(resolver: SessionResolver | null) {
  testResolver = resolver;
}

/** The signed-in user for this request, or null. Errors fail closed. */
export async function currentUser(req: Request): Promise<SessionUser | null> {
  if (testResolver) return testResolver(req);
  const auth = getAuth();
  if (!auth) return null;
  // No session cookie, no lookup: anonymous traffic never touches the auth DB.
  if (
    !/(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(
      req.headers.get("cookie") ?? "",
    )
  )
    return null;
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const user = session?.user;
    if (!user || typeof user.email !== "string") return null;
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified === true,
      name: user.name,
      image: user.image,
    };
  } catch {
    // Never log: errors can include connection strings or cookie values.
    return null;
  }
}

/** Lower-cased allow-list from ADMIN_EMAILS (comma-separated). */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/** Admin = signed in with a provider-verified email listed in ADMIN_EMAILS. */
export function isAdmin(user: SessionUser | null): boolean {
  return (
    !!user &&
    user.emailVerified &&
    adminEmails().has(user.email.trim().toLowerCase())
  );
}
