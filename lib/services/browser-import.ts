import type { Schema, Format } from "../types/schema";
import { preflight } from "../importers/preflight";
let cachedWorker: Worker | null = null;
let nextRequest = 0;
let cancelPending: (() => void) | null = null;
export function warmParser() {
  if (!cachedWorker)
    cachedWorker = new Worker(new URL("./schema.worker.ts", import.meta.url));
  return cachedWorker;
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
    const timer = setTimeout(() => {
      worker.terminate();
      cachedWorker = null;
      reject(new Error("Parsing timed out. Try a smaller schema."));
    }, 30_000);
    const finish = () => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      cancelPending = null;
    };
    cancelPending = () => {
      clearTimeout(timer);
      cancelPending = null;
      reject(new Error("Superseded by a newer import."));
    };
    worker.onmessage = (event) => {
      // A newer import replaced this handler; ignore replies to older ones.
      if (event.data?.id !== id) return;
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.schema);
    };
    worker.onerror = () => {
      finish();
      worker.terminate();
      cachedWorker = null;
      reject(
        new Error(
          "Could not load the local schema parser. Refresh the page and try again.",
        ),
      );
    };
    worker.postMessage({ id, schema, format });
  });
}
