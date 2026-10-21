import type { Schema, Format } from "../types/schema";
import { preflight } from "../importers/preflight";

/** The parser could not be downloaded or started (network, timeout). Retryable. */
export class ParserLoadError extends Error {
  name = "ParserLoadError";
}
/** A newer import replaced this one. Not a failure; do not report it. */
export class ImportCancelled extends Error {
  name = "ImportCancelled";
}

// Download budget for the worker and its parser chunk (slow mobile networks),
// then a separate budget for the parse itself once the parser is loaded.
export const PARSER_LOAD_TIMEOUT_MS = 120_000;
export const PARSE_TIMEOUT_MS = 30_000;

let cachedWorker: Worker | null = null;
let nextRequest = 0;
let cancelPending: (() => void) | null = null;

export function warmParser(format?: Format) {
  if (!cachedWorker)
    cachedWorker = new Worker(new URL("./schema.worker.ts", import.meta.url));
  if (format) cachedWorker.postMessage({ preload: format });
  return cachedWorker;
}

function discardWorker(worker: Worker) {
  worker.terminate();
  if (cachedWorker === worker) cachedWorker = null;
}

export function importInBrowser(
  schema: string,
  format: Format | "auto",
): Promise<Schema> {
  return new Promise((resolve, reject) => {
    preflight(schema);
    const worker = warmParser();
    const id = ++nextRequest;
    // Only one import is in flight; a newer one supersedes the older request.
    cancelPending?.();
    let timer = setTimeout(() => {
      finish();
      discardWorker(worker);
      reject(
        new ParserLoadError(
          "The schema parser is still downloading. Check your connection and retry.",
        ),
      );
    }, PARSER_LOAD_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      cancelPending = null;
    };
    cancelPending = () => {
      clearTimeout(timer);
      cancelPending = null;
      reject(new ImportCancelled("Superseded by a newer import."));
    };
    worker.onmessage = (event) => {
      // A newer import replaced this handler; ignore replies to older ones.
      if (event.data?.id !== id) return;
      if (event.data.phase === "loaded") {
        // The parser is ready: only now does the parse timeout start.
        clearTimeout(timer);
        timer = setTimeout(() => {
          finish();
          discardWorker(worker);
          reject(new Error("Parsing timed out. Try a smaller schema."));
        }, PARSE_TIMEOUT_MS);
        return;
      }
      finish();
      if (event.data.loadError) {
        // Webpack does not retry a failed chunk in this worker; start fresh.
        discardWorker(worker);
        reject(
          new ParserLoadError(
            "Could not download the schema parser. Check your connection and retry.",
          ),
        );
      } else if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.schema);
    };
    worker.onerror = () => {
      finish();
      discardWorker(worker);
      reject(
        new ParserLoadError(
          "Could not load the local schema parser. Check your connection and retry.",
        ),
      );
    };
    worker.postMessage({ id, schema, format });
  });
}
