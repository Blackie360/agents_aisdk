import { importSchema } from "../importers";
self.onmessage = (event: MessageEvent) => {
  try {
    self.postMessage({
      schema: importSchema(event.data.schema, event.data.format),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Import failed.",
    });
  }
};
