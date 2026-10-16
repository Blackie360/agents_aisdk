import type { Schema, Format } from "../types/schema";
import { preflight } from "../importers/preflight";
let cachedWorker: Worker | null = null;
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
    const timer = setTimeout(() => {
      worker.terminate();
      cachedWorker = null;
      reject(new Error("Parsing timed out. Try a smaller schema."));
    }, 30_000);
    const finish = () => {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
    };
    worker.onmessage = (event) => {
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
    worker.postMessage({ schema, format });
  });
}
