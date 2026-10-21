import { importError } from "../importers/preflight";
import { resolveFormat } from "../importers/resolve";
import { lazyImporters } from "../importers/lazy";
import { finalize } from "../importers/model";
// Each message carries a request id; every reply echoes it so overlapping
// imports never receive each other's result.
// Phases: "loaded" once the format's parser chunk is in memory (the client
// starts its parse timeout only then, so slow downloads are not cut off).
self.onmessage = async (event: MessageEvent) => {
  const { id, schema, format, preload } = event.data ?? {};
  if (preload) {
    // Warm a parser chunk ahead of time; failures are retried on real use.
    if (Object.hasOwn(lazyImporters, preload))
      void lazyImporters[preload as keyof typeof lazyImporters]().catch(
        () => undefined,
      );
    return;
  }
  let resolved;
  try {
    resolved = resolveFormat(schema, format);
  } catch (error) {
    self.postMessage({ id, error: importError(error) });
    return;
  }
  let parse;
  try {
    parse = await lazyImporters[resolved]();
  } catch {
    self.postMessage({ id, loadError: true });
    return;
  }
  self.postMessage({ id, phase: "loaded" });
  try {
    self.postMessage({ id, schema: finalize(parse(schema)) });
  } catch (error) {
    self.postMessage({ id, error: importError(error) });
  }
};
self.postMessage({ ready: true });
