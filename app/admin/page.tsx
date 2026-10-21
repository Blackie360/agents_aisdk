"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UsageSummary } from "@/lib/analytics/events";
import { SignInButtons, signOut, useAccount } from "@/components/auth/account";

export default function AdminPage() {
  const account = useAccount();
  const [denied, setDenied] = useState<"signin" | "forbidden" | null>(null);
  const [data, setData] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load() {
    const version = generation.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/usage", {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json();
      if (version !== generation.current) return;
      setDenied(
        response.status === 401
          ? "signin"
          : response.status === 403
            ? "forbidden"
            : null,
      );
      if (response.status === 401 || response.status === 403) {
        setData(null);
        return;
      }
      if (!response.ok)
        throw new Error(result.message || "Could not load usage.");
      setData(result);
    } catch (e) {
      if (version === generation.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load usage.");
      }
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const sum = (kind: string, outcome?: string) =>
    data?.totals
      .filter((r) => r.kind === kind && (!outcome || r.outcome === outcome))
      .reduce((n, r) => n + r.count, 0) ?? 0;
  const days = Array.from({ length: 30 }, (_, i) =>
    new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
  );
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-teal-800">
            ← SchemaMind
          </Link>
          <h1 className="mt-4 text-3xl font-semibold">Usage dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Private activity totals · UTC
          </p>
        </div>
        {account?.user && (
          <div className="flex flex-col items-end gap-2 text-sm">
            <span className="text-slate-600">{account.user.email}</span>
            <button
              onClick={() => void signOut()}
              className="rounded-xl border px-4 py-2"
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      {!data && denied && (
        <section className="max-w-md space-y-4 rounded-2xl border bg-white p-6">
          <h2 className="font-medium">
            {denied === "signin" ? "Admin sign-in" : "Not an admin account"}
          </h2>
          <p className="text-sm text-slate-600">
            {denied === "signin"
              ? "Sign in with an account whose verified email is on the admin list."
              : "You're signed in, but this email isn't on the admin list. Sign out and use an admin account."}
          </p>
          {denied === "signin" && (
            <SignInButtons
              providers={account?.providers ?? []}
              callbackURL="/admin"
            />
          )}
        </section>
      )}
      {!data && !denied && busy && (
        <p className="text-sm text-slate-600">Loading usage…</p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["visualization", "Schema visualizations"],
              ["explanation", "AI explanations"],
            ].map(([kind, title]) => (
              <section key={kind} className="rounded-2xl border bg-white p-6">
                <h2 className="text-slate-600">{title}</h2>
                <p className="my-3 text-5xl font-semibold tabular-nums">
                  {sum(kind).toLocaleString()}
                </p>
                <p className="text-sm text-slate-600">
                  {sum(kind, "success").toLocaleString()} successful ·{" "}
                  {sum(kind, "failure").toLocaleString()} failed
                </p>
              </section>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Last 30 days</h2>
            <button
              disabled={busy}
              onClick={() => void load()}
              className="rounded-xl border px-4 py-2"
            >
              {busy ? "Refreshing…" : "Refresh totals"}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Daily visualization and AI explanation attempts in UTC
              </caption>
              <thead>
                <tr className="border-b bg-slate-50">
                  {[
                    "Date (UTC)",
                    "Visualizations",
                    "AI explanations",
                    "Failures",
                  ].map((t) => (
                    <th key={t} scope="col" className="p-4">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => {
                  const rows = data.daily.filter((r) => r.day === day);
                  const count = (kind: string) =>
                    rows
                      .filter((r) => r.kind === kind)
                      .reduce((n, r) => n + r.count, 0);
                  return (
                    <tr key={day} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="whitespace-nowrap p-4 font-normal"
                      >
                        {day}
                      </th>
                      <td className="p-4">{count("visualization")}</td>
                      <td className="p-4">{count("explanation")}</td>
                      <td className="p-4">
                        {rows
                          .filter((r) => r.outcome === "failure")
                          .reduce((n, r) => n + r.count, 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            {data.firstEvent
              ? `First recorded event: ${new Date(data.firstEvent).toISOString().slice(0, 10)}. `
              : "No activity recorded yet. "}
            Visualizations are browser-reported attempts; AI counts come from
            the server. These are operational estimates, not billing records.
            Blocked requests and storage outages can cause undercounting;
            automated clients can inflate browser counts. No historical
            backfill. No schema contents or API keys are stored.
          </p>
        </>
      )}
    </main>
  );
}
