"use client";
import { reportVisualization } from "@/lib/analytics/browser";
import { useEffect, useRef, useState } from "react";
import {
  Database,
  LoaderCircle,
  ArrowUpRight,
  Download,
  Sparkles,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { aiProviders, AIProvider } from "@/lib/services/ai-providers";
import { SchemaReview } from "@/components/schema/schema-review";
import { DiagramCanvas } from "@/components/schema/diagram-canvas";
import { TableDetailsDrawer } from "@/components/schema/table-details-drawer";
import { generateDiagram } from "@/lib/services/diagram-generator";
import { mermaid } from "@/lib/services/exports";
import { formats, examples } from "@/lib/importers/catalog";
import { isSchemaCandidate } from "@/lib/importers/discovery";
import { readApiResponse } from "@/lib/services/api-response";
import { Explanation } from "@/components/schema/explanation";
import {
  AccountMenu,
  SignupPrompt,
  type Provider,
} from "@/components/auth/account";
import { createPreflightGuard } from "@/lib/importers/preflight";
import { importInBrowser, warmParser } from "@/lib/services/browser-import";
import { Format, Schema, Table } from "@/lib/types/schema";
export default function HomePage() {
  const [format, setFormatState] = useState<Format | "auto">("auto");
  const [input, setInputState] = useState(examples.postgresql);
  const [validateInput] = useState(() => createPreflightGuard());
  const recoveringDraft = useRef(false);
  function setFormat(value: Format | "auto") {
    recoveringDraft.current = false;
    setFormatState(value);
  }
  function setInput(value: string) {
    recoveringDraft.current = false;
    setInputState(value);
  }
  const pendingDraft = useRef<{
    input: string;
    format: Format | "auto";
  } | null>(null);
  function flushDraft(notify = true) {
    const draft = pendingDraft.current;
    if (!draft) return;
    pendingDraft.current = null;
    try {
      if (draft.input)
        localStorage.setItem(
          "schemamind.draft.v1",
          JSON.stringify({ version: 1, ...draft }),
        );
      else localStorage.removeItem("schemamind.draft.v1");
      if (notify)
        setDraftStatus(
          draft.input ? "Draft saved in this browser." : "Draft cleared.",
        );
    } catch {
      if (notify)
        setDraftStatus(
          "Draft could not be saved. Keep a copy before refreshing.",
        );
    }
  }
  useEffect(() => {
    const hide = () => flushDraft();
    const visibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      flushDraft(false);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const sourceInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = sourceInput.current;
    if (!element) return;
    const guard = (event: InputEvent) => {
      if (!event.data || !event.inputType.startsWith("insert")) return;
      try {
        validateInput(
          element.value.slice(0, element.selectionStart) +
            event.data +
            element.value.slice(element.selectionEnd),
        );
      } catch (error) {
        event.preventDefault();
        setError(error instanceof Error ? error.message : "Input too large.");
      }
    };
    element.addEventListener("beforeinput", guard);
    return () => element.removeEventListener("beforeinput", guard);
  }, []);
  const supportDetails = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    try {
      warmParser();
    } catch {
      /* Retry when requested. */
    }
  }, []);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("schemamind.draft.v1");
      if (raw) {
        const draft = JSON.parse(raw);
        if (
          draft.version === 1 &&
          typeof draft.input === "string" &&
          (draft.format === "auto" ||
            formats.some((f) => f.id === draft.format))
        ) {
          try {
            validateInput(draft.input);
          } catch {
            recoveringDraft.current = true;
            localStorage.removeItem("schemamind.draft.v1");
            setDraftStatus(
              "Oversized draft removed. Import up to 150 entities at a time.",
            );
            setDraftReady(true);
            return;
          }
          setInput(draft.input);
          setFormat(draft.format);
        }
      }
    } catch {
      setDraftStatus("Draft storage unavailable in this browser.");
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady || recoveringDraft.current) return;
    // Every entry path validates before accepting input. Do not rescan for autosave.
    pendingDraft.current = { input, format };
    if (!input) {
      flushDraft();
      return;
    }
    setDraftStatus("Saving draft…");
    const timer = setTimeout(() => flushDraft(), 400);
    return () => clearTimeout(timer);
  }, [input, format, draftReady]);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [diagram, setDiagram] = useState<ReturnType<
    typeof generateDiagram
  > | null>(null);
  const [selected, setSelected] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [explanation, setExplanation] = useState(""),
    [aiBusy, setAiBusy] = useState(false);
  const [signup, setSignup] = useState<{
    message: string;
    providers: Provider[];
  } | null>(null);
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  const [provider, setProvider] = useState<AIProvider>("xai");
  const [model, setModel] = useState("");
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
      validateInput(content);
      setInput(content);
      setFormat("auto");
    } catch {
      if (version === generation.current)
        setError(
          "Could not import this file. Check the 200 KB and 150 entity limits.",
        );
    }
  }
  async function visualize() {
    clearResult();
    const version = generation.current;
    setBusy(true);
    try {
      const parsed = await importInBrowser(input, format);
      reportVisualization("success");
      if (version !== generation.current) return;
      setSchema(parsed);
      setDiagram(generateDiagram(parsed));
    } catch (e) {
      reportVisualization("failure");
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
    setSignup(null);
    try {
      const response = await fetch("/api/schema-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema,
          provider,
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
        signal: AbortSignal.timeout(65_000),
      });
      if (response.status === 401) {
        const denied = await response
          .clone()
          .json()
          .catch(() => null);
        if (denied?.error === "signup_required") {
          if (version === generation.current)
            setSignup({
              message:
                typeof denied.message === "string"
                  ? denied.message.slice(0, 300)
                  : "Sign in to keep explaining schemas, or bring your own API key.",
              providers: Array.isArray(denied.providers)
                ? denied.providers.filter((p: unknown) =>
                    ["google", "github"].includes(p as string),
                  )
                : [],
            });
          return;
        }
      }
      const data = await readApiResponse(response);
      const left = Number(
        response.headers.get("x-free-explanations-remaining") ?? NaN,
      );
      if (version === generation.current)
        setFreeLeft(Number.isFinite(left) ? left : null);
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
        <div className="flex items-center gap-4">
          <a
            href="#support"
            onClick={() => {
              if (supportDetails.current) supportDetails.current.open = true;
            }}
            className="text-xs text-muted-foreground hover:text-teal-800"
          >
            Supported formats <ArrowUpRight className="inline" size={13} />
          </a>
          <AccountMenu />
        </div>
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
            ref={sourceInput}
            onPaste={(event) => {
              const element = event.currentTarget;
              try {
                validateInput(
                  element.value.slice(0, element.selectionStart) +
                    event.clipboardData.getData("text") +
                    element.value.slice(element.selectionEnd),
                );
              } catch (error) {
                event.preventDefault();
                setError(
                  error instanceof Error ? error.message : "Input too large.",
                );
              }
            }}
            spellCheck={false}
            value={input}
            onChange={(e) => {
              clearResult();
              try {
                validateInput(e.target.value);
                setInput(e.target.value);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Input too large.");
              }
            }}
            className="w-full h-64 resize-y rounded-xl border bg-background p-3 font-mono text-xs leading-6 focus:outline-teal-700"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span aria-live="polite">{draftStatus}</span>
            <button
              disabled={busy || !draftReady}
              onClick={() => {
                setInput("");
                setFormat("auto");
                clearResult();
              }}
              className="text-teal-700"
            >
              Clear draft
            </button>
          </div>
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
            choose Explain. 200 KB per import. Anonymous run counts are
            recorded.
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
          {schema?.tables.some((t) => t.kind === "document") && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Mermaid ERD is for relational tables. Use JSON export for document
              structures.
            </p>
          )}
          <div className="h-[500px] md:h-[570px]">
            {busy ? (
              <div
                aria-live="polite"
                className="h-full flex flex-col items-center justify-center gap-3 text-teal-800"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                  size={28}
                />
                <p className="font-medium">Parsing locally…</p>
                <p className="text-xs text-muted-foreground">
                  You can keep editing while the diagram is prepared.
                </p>
              </div>
            ) : diagram ? (
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
      {schema && <SchemaReview schema={schema} onSelect={setSelected} />}
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
            <details
              open={schema.warnings.some((note) =>
                note.includes("Unresolved reference"),
              )}
              className="mt-4 text-xs text-amber-800"
            >
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
                {aiBusy
                  ? "Explaining…"
                  : `Explain with ${provider === "xai" ? "Grok" : aiProviders[provider].name}`}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              AI explanations can be inaccurate. Check the schema.
            </p>
            <div className="mt-4 space-y-2">
              <fieldset>
                <legend className="mb-2 text-xs font-medium">
                  AI provider
                </legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
                  {Object.entries(aiProviders).map(([id, config]) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={`Use ${config.name}`}
                      aria-pressed={provider === id}
                      disabled={aiBusy}
                      onClick={() => {
                        if (provider === id) return;
                        setProvider(id as AIProvider);
                        setApiKey("");
                        setModel("");
                        setExplanation("");
                      }}
                      className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50 ${provider === id ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700 text-teal-900" : "border-border bg-white hover:bg-teal-50"}`}
                    >
                      <img
                        src={`/providers/${id}${["gemini", "kimi", "claude"].includes(id) ? "-color" : ""}.svg`}
                        alt=""
                        width={28}
                        height={28}
                        className={`h-7 w-7 object-contain ${id === "kimi" ? "rounded bg-slate-900 p-1" : ""}`}
                      />
                      <span>{config.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="ai-model" className="block text-xs font-medium">
                Model (optional)
              </label>
              <input
                id="ai-model"
                value={model}
                disabled={aiBusy}
                onChange={(e) => setModel(e.target.value)}
                placeholder={aiProviders[provider].model}
                maxLength={100}
                className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
              />
              <label htmlFor="xai-key" className="block text-xs font-medium">
                Bring your own {aiProviders[provider].name} API key (optional)
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
                  placeholder="API key"
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
                Explain sends your schema and key through this server to{" "}
                {aiProviders[provider].name}; usage is billed to your key. Your
                key is kept only until cleared or refreshed; switching providers
                clears it. Leave blank to use a configured server key.
              </p>
            </div>
            {signup ? (
              <SignupPrompt
                message={signup.message}
                providers={signup.providers}
              />
            ) : (
              <Explanation text={explanation} />
            )}
            {freeLeft !== null && !signup && (
              <p className="mt-2 text-xs text-muted-foreground">
                {freeLeft === 0
                  ? "No free explanations left. Sign in to keep going."
                  : freeLeft === 1
                    ? "1 free explanation left. Sign in to keep going."
                    : `${freeLeft} free explanations left.`}
              </p>
            )}
          </div>
        </section>
      )}
      <section id="support" className="px-5 md:px-10 py-8">
        <details ref={supportDetails}>
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
