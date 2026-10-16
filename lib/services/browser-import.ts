import type { Schema, Format } from "../types/schema";
export function importInBrowser(
  schema: string,
  format: Format | "auto",
): Promise<Schema> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./schema.worker.ts", import.meta.url));
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Parsing timed out. Try a smaller schema."));
    }, 30_000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (event) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.schema);
    };
    worker.onerror = () => {
      finish();
      reject(
        new Error(
          "Could not load the local schema parser. Refresh the page and try again.",
        ),
      );
    };
    worker.postMessage({ schema, format });
  });
}
