"use client";
import { useRef, useState } from "react";
import {
  Database,
  ArrowUpRight,
  Download,
  Sparkles,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { DiagramCanvas } from "@/components/schema/diagram-canvas";
import { TableDetailsDrawer } from "@/components/schema/table-details-drawer";
import { generateDiagram } from "@/lib/services/diagram-generator";
import { mermaid } from "@/lib/services/exports";
import { formats, examples } from "@/lib/importers/catalog";
import { isSchemaCandidate } from "@/lib/importers/discovery";
import { readApiResponse } from "@/lib/services/api-response";
import { importInBrowser } from "@/lib/services/browser-import";
import { Format, Schema, Table } from "@/lib/types/schema";
export default function HomePage() {
  const [format, setFormat] = useState<Format | "auto">("auto");
  const [input, setInput] = useState(examples.postgresql);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [diagram, setDiagram] = useState<ReturnType<
    typeof generateDiagram
  > | null>(null);
  const [selected, setSelected] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [explanation, setExplanation] = useState(""),
    [aiBusy, setAiBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const generation = useRef(0);
  const folder = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<File[]>([]);
  const file = useRef<HTMLInputElement>(null);
  function clearResult() {
    generation.current++;
    setSchema(null);
    setDiagram(null);
    setSelected(null);
    setExplanation("");
    setAiBusy(false);
    setError("");
  }
  async function openFile(f: File) {
    clearResult();
    if (f.size > 200_000) {
      setError("File exceeds 200 KB.");
      return;
    }
    const version = generation.current;
    try {
      const content = await f.text();
      if (version !== generation.current) return;
      setInput(content);
      setFormat("auto");
    } catch {
      if (version === generation.current) setError("Could not read this file.");
    }
  }
  async function visualize() {
    clearResult();
    const version = generation.current;
    setBusy(true);
    try {
      const parsed = await importInBrowser(input, format);
      if (version !== generation.current) return;
      setSchema(parsed);
      setDiagram(generateDiagram(parsed));
    } catch (e) {
      if (version === generation.current)
        setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  async function explain() {
    const version = generation.current;
    setAiBusy(true);
    setExplanation("");
    try {
      const response = await fetch("/api/schema-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await readApiResponse(response);
      if (typeof data.explanation !== "string" || !data.explanation.trim())
        throw new Error(
          "The server returned an empty AI explanation. Your diagram remains available.",
        );
      if (version === generation.current) setExplanation(data.explanation);
    } catch (e) {
      if (version === generation.current)
        setExplanation(
          e instanceof Error
            ? e.message
            : "AI unavailable. Your diagram is ready.",
        );
    } finally {
      if (version === generation.current) setAiBusy(false);
    }
  }
  function download(kind: "json" | "mmd") {
    if (!schema) return;
    const url = URL.createObjectURL(
      new Blob(
        [kind === "json" ? JSON.stringify(schema, null, 2) : mermaid(schema)],
        { type: kind === "json" ? "application/json" : "text/plain" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `schemamind.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="min-h-screen app-shell">
      <header className="flex items-center justify-between border-b px-5 md:px-10 py-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-teal-700/10 p-2 text-teal-700">
            <Database size={24} />
          </span>
          <div>
            <h1 className="text-xl tracking-tight">
              SchemaMind<span className="text-teal-700">.</span>
            </h1>
          </div>
        </div>
        <a
          href="#support"
          className="text-xs text-muted-foreground hover:text-teal-800"
        >
          Supported formats <ArrowUpRight className="inline" size={13} />
        </a>
      </header>
      <section className="hero px-5 md:px-10 pt-10 pb-8">
        <div className="flex flex-wrap gap-6 items-end justify-between">
          <div>
            <h2 className="text-4xl md:text-5xl tracking-[-.045em] leading-[1.08] font-semibold max-w-2xl">
              Your schema, <span className="text-teal-800">visualized.</span>
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl leading-7">
              Paste SQL, Prisma or Drizzle. Explore the connections.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-7">
          <span className="text-xs text-muted-foreground mr-2">
            Try an example
          </span>
          {(["postgresql", "prisma", "drizzle", "json-schema"] as Format[]).map(
            (f) => (
              <button
                key={f}
                disabled={busy}
                onClick={() => {
                  clearResult();
                  setFormat(f);
                  setInput(examples[f]);
                }}
                className="example-chip"
              >
                {f === "json-schema"
                  ? "Document"
                  : f === "postgresql"
                    ? "PostgreSQL"
                    : f === "prisma"
                      ? "Prisma"
                      : "Drizzle"}
                <ArrowUpRight size={12} />
              </button>
            ),
          )}
        </div>
      </section>
      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-5 px-5 md:px-10">
        <section
          className="rounded-2xl border bg-card p-5 space-y-4 source-panel"
          aria-label="Schema input"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="step-number">1</span> Add your schema
          </div>
          <div>
            <label
              htmlFor="format"
              className="block text-xs text-muted-foreground mb-2"
            >
              Input format
            </label>
            <select
              id="format"
              className="w-full rounded-lg border bg-background p-2 text-sm"
              value={format}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.value as Format | "auto";
                setFormat(f);
                clearResult();
              }}
            >
              <option value="auto">Auto-detect format</option>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between text-xs">
            <label htmlFor="source" className="text-muted-foreground">
              Schema source
            </label>
            <button
              disabled={busy}
              className="text-teal-700"
              onClick={() => {
                setInput(examples[format === "auto" ? "postgresql" : format]);
                clearResult();
              }}
            >
              Load example
            </button>
          </div>
          <textarea
            id="source"
            spellCheck={false}
            disabled={busy}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              clearResult();
            }}
            className="w-full h-64 resize-y rounded-xl border bg-background p-3 font-mono text-xs leading-6 focus:outline-teal-700"
          />
          <div className="flex gap-2">
            <button
              disabled={busy || !input.trim()}
              onClick={visualize}
              className="flex-1 bg-teal-800 hover:bg-teal-700 text-white font-semibold rounded-lg px-3 py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? "Parsing…" : "Visualize schema"}
            </button>
            <button
              disabled={busy}
              onClick={() => file.current?.click()}
              className="rounded-lg border px-3 text-sm"
            >
              Open file
            </button>
          </div>
          <input
            ref={file}
            type="file"
            aria-label="Upload schema file"
            className="hidden"
            accept=".sql,.prisma,.ts,.js,.json,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await openFile(f);
              e.target.value = "";
            }}
          />
          <button
            disabled={busy}
            onClick={() => folder.current?.click()}
            className="text-xs text-teal-700"
          >
            <FolderOpen size={14} className="inline mr-1" />
            Find schemas in a project folder
          </button>
          <input
            ref={folder}
            type="file"
            multiple
            {...{ webkitdirectory: "" }}
            className="hidden"
            aria-label="Find schema files in folder"
            onChange={(e) => {
              const all = Array.from(e.target.files ?? []);
              setCandidates(
                all
                  .filter((f) => isSchemaCandidate(f.webkitRelativePath))
                  .slice(0, 100),
              );
              setError(
                all.some((f) => isSchemaCandidate(f.webkitRelativePath))
                  ? ""
                  : "No candidate schema files found in this folder.",
              );
              e.target.value = "";
            }}
          />
          {candidates.length > 0 && (
            <div className="max-h-40 overflow-auto border rounded-lg p-2">
              <p className="text-xs text-muted-foreground mb-2">
                Select a candidate (up to 100 shown). Only the selected file is
                read.
              </p>
              {candidates.map((f) => (
                <button
                  disabled={busy}
                  key={f.webkitRelativePath}
                  onClick={() => openFile(f)}
                  className="block text-left text-xs text-teal-800 break-all py-1"
                >
                  {f.webkitRelativePath}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs leading-5 text-muted-foreground">
            Schema parsing stays in your browser. AI receives it only when you
            choose Explain. 200 KB per import.
          </p>
          {error && (
            <p
              role="alert"
              className="text-sm text-red-700 border border-red-500/30 rounded-lg p-3 whitespace-pre-wrap"
            >
              {error}
            </p>
          )}
        </section>
        <section
          className="min-w-0 rounded-2xl border overflow-hidden canvas-panel"
          aria-label="Schema visualization"
        >
          <div className="flex flex-wrap justify-between gap-3 items-center border-b px-4 py-3 bg-card">
            <div className="flex gap-2 items-center text-sm">
              <span className="step-number">2</span>
              {schema?.tables[0]?.kind === "document"
                ? "Document structure"
                : "Relationship diagram"}
            </div>
            <div className="flex gap-3 text-xs">
              <button
                disabled={!schema}
                onClick={() => download("json")}
                className="disabled:opacity-30"
              >
                <Download size={13} className="inline mr-1" />
                JSON
              </button>
              <button
                disabled={
                  !schema || schema.tables.some((t) => t.kind === "document")
                }
                onClick={() => download("mmd")}
                className="disabled:opacity-30"
              >
                Mermaid ERD
              </button>
            </div>
          </div>
          <div className="h-[500px] md:h-[570px]">
            {diagram ? (
              <DiagramCanvas
                key={generation.current}
                nodes={diagram.nodes}
                edges={diagram.edges}
                onNodeClick={setSelected}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-8 diagram-empty">
                <div className="preview-graphic" aria-hidden="true">
                  <div className="preview-card preview-one">
                    <span className="preview-label">teams</span>
                    <p>
                      <i />
                      id <em>integer</em>
                    </p>
                    <p>
                      <i />
                      name <em>text</em>
                    </p>
                  </div>
                  <div className="preview-connector" />
                  <div className="preview-card preview-two">
                    <span className="preview-label">members</span>
                    <p>
                      <i />
                      id <em>integer</em>
                    </p>
                    <p>
                      <i />
                      team_id <em>integer</em>
                    </p>
                  </div>
                </div>
                <h3 className="text-xl tracking-tight mt-8">
                  Your diagram starts here
                </h3>
                <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-6">
                  Add a schema, then select Visualize.
                </p>
                <button
                  disabled={busy}
                  onClick={visualize}
                  className="mt-5 text-sm font-medium text-teal-800 flex items-center gap-2"
                >
                  Try this schema <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      {schema && (
        <section className="mx-5 md:mx-10 mt-5 grid md:grid-cols-2 gap-5">
          <div className="border rounded-xl p-4">
            <h3 className="text-sm mb-3">
              {schema.metadata.database} · {schema.tables.length} entities ·{" "}
              {schema.relationships.length} relationships
            </h3>
            <div className="flex gap-2 flex-wrap">
              {schema.tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="text-xs border rounded-lg px-3 py-2 hover:border-teal-600"
                >
                  {t.name}{" "}
                  <span className="text-muted-foreground">
                    {t.columns.length} fields
                  </span>
                </button>
              ))}
            </div>
            <details className="mt-4 text-xs text-amber-800">
              <summary className="cursor-pointer">
                Import notes ({schema.warnings.length})
              </summary>
              <ul className="list-disc pl-4 mt-2 space-y-2">
                {schema.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          </div>
          <div className="border rounded-xl p-4">
            <div className="flex justify-between items-center gap-3">
              <h3 className="text-sm">
                <Sparkles size={15} className="inline text-teal-700 mr-2" />
                Optional explanation
              </h3>
              <button
                disabled={aiBusy}
                onClick={explain}
                className="border rounded-lg px-3 py-2 text-xs"
              >
                {aiBusy ? "Explaining…" : "Explain with Grok"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              AI explanations can be inaccurate. Check the schema.
            </p>
            <div className="mt-4 space-y-2">
              <label htmlFor="xai-key" className="block text-xs font-medium">
                Bring your own xAI API key (optional)
              </label>
              <div className="flex gap-2">
                <input
                  id="xai-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={512}
                  value={apiKey}
                  disabled={aiBusy}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="xai-…"
                  aria-describedby="key-privacy"
                  className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 text-sm"
                />
                <button
                  disabled={!apiKey || aiBusy}
                  onClick={() => setApiKey("")}
                  className="border rounded-lg px-3 py-2 text-xs disabled:opacity-40"
                >
                  Clear key
                </button>
              </div>
              <p
                id="key-privacy"
                className="text-xs text-muted-foreground leading-5"
              >
                Explain sends your schema and key through this server to xAI;
                usage is billed to your key. Your key is kept only until cleared
                or refreshed. Leave blank to use a configured server key.
              </p>
            </div>
            <p
              role="status"
              className="mt-4 text-sm whitespace-pre-wrap leading-6"
            >
              {explanation}
            </p>
          </div>
        </section>
      )}
      <section id="support" className="px-5 md:px-10 py-8">
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Supported formats &amp; limits · 7 importers
          </summary>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
            {formats.map((f) => (
              <article
                key={f.id}
                className="border rounded-xl p-4 text-xs leading-5"
              >
                <h3 className="text-sm mb-2">{f.label}</h3>
                <p className="text-muted-foreground">{f.support}</p>
                <p className="mt-2 text-amber-800">Limits: {f.limits}</p>
              </article>
            ))}
          </div>
        </details>
      </section>
      <footer className="mx-5 md:mx-10 border-t py-6 flex justify-between text-xs text-muted-foreground">
        <span>SchemaMind</span>
        <span>Local parsing. Optional AI.</span>
      </footer>
      <TableDetailsDrawer
        table={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
