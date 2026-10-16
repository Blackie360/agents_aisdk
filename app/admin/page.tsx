"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { UsageSummary } from "@/lib/analytics/events";

export default function AdminPage() {
  const [password, setPassword] = useState("");
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
        headers: { Authorization: `Bearer ${password}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json();
      if (version !== generation.current) return;
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
  function lock() {
    generation.current++;
    setData(null);
    setPassword("");
    setError("");
    setBusy(false);
  }
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
        {data && (
          <button onClick={lock} className="rounded-xl border px-4 py-2">
            Lock dashboard
          </button>
        )}
      </header>
      {!data && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="max-w-md space-y-4 rounded-2xl border bg-white p-6"
        >
          <label htmlFor="admin-password" className="block font-medium">
            Admin password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={512}
            className="w-full rounded-xl border p-3"
          />
          <button
            disabled={busy}
            className="rounded-xl bg-teal-700 px-5 py-3 text-white disabled:opacity-60"
          >
            {busy ? "Loading usage…" : "Open dashboard"}
          </button>
          <p className="text-sm text-slate-600">
            The password stays in memory until you lock this page or refresh.
          </p>
        </form>
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
