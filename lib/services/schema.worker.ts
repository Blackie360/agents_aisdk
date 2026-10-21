import { importError } from "../importers/preflight";
import { importSchema } from "../importers";
self.onmessage = (event: MessageEvent) => {
  // Echo the request id so overlapping imports never receive each other's result.
  const id = event.data.id;
  try {
    self.postMessage({
      id,
      schema: importSchema(event.data.schema, event.data.format),
    });
  } catch (error) {
    self.postMessage({
      id,
      error: importError(error),
    });
  }
};
