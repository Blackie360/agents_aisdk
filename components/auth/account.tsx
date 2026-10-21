"use client";
import { useEffect, useState } from "react";

export type Provider = "google" | "github";
export type Account = {
  providers: Provider[];
  user: { name: string | null; email: string; image: string | null } | null;
  admin: boolean;
};
const labels: Record<Provider, string> = { google: "Google", github: "GitHub" };

/** Current sign-in state from /api/account (null while loading or on error). */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (live && data && Array.isArray(data.providers)) setAccount(data);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return account;
}

async function signIn(provider: Provider, callbackURL: string) {
  const response = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, callbackURL }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.url !== "string")
    throw new Error("Sign-in is unavailable right now. Try again later.");
  window.location.href = data.url;
}

export async function signOut() {
  await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => undefined);
  window.location.reload();
}

/** One button per configured provider. Renders nothing if none are set. */
export function SignInButtons({
  providers,
  callbackURL,
}: {
  providers: Provider[];
  callbackURL?: string;
}) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState("");
  if (!providers.length)
    return (
      <p className="text-xs text-muted-foreground">
        Sign-in is not configured on this deployment.
      </p>
    );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <button
            key={p}
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy(p);
              setError("");
              try {
                await signIn(
                  p,
                  callbackURL ??
                    window.location.pathname + window.location.search,
                );
              } catch (e) {
                setBusy(null);
                setError(e instanceof Error ? e.message : "Sign-in failed.");
              }
            }}
            className="rounded-lg border bg-white px-3 py-2 text-xs hover:bg-teal-50 disabled:opacity-50"
          >
            {busy === p ? "Redirecting…" : `Continue with ${labels[p]}`}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

/** Header control: sign in (when providers exist) or the user and sign out. */
export function AccountMenu() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  if (!account || (!account.user && !account.providers.length)) return null;
  if (account.user)
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="max-w-40 truncate text-muted-foreground">
          {account.user.email}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border px-3 py-1.5 hover:bg-teal-50"
        >
          Sign out
        </button>
      </div>
    );
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-teal-50"
      >
        Sign in
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border bg-card p-4 shadow-lg">
          <p className="mb-3 text-xs text-muted-foreground">
            Sign in for more free explanations.
          </p>
          <SignInButtons providers={account.providers} />
        </div>
      )}
    </div>
  );
}

/** Shown in place of an explanation once the free trials are used. */
export function SignupPrompt({
  message,
  providers,
}: {
  message: string;
  providers: Provider[];
}) {
  return (
    <div
      role="status"
      className="mt-4 space-y-3 rounded-lg border border-teal-700/30 bg-teal-50 p-4"
    >
      <p className="text-sm font-medium text-teal-900">Create a free account</p>
      <p className="text-xs leading-5 text-muted-foreground">{message}</p>
      <SignInButtons providers={providers} />
    </div>
  );
}
