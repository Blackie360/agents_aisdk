export function reportVisualization(outcome: "success" | "failure") {
  // Best effort; telemetry must never delay or break local parsing.
  try {
    void fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        kind: "visualization",
        outcome,
      }),
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    /* Unsupported browser APIs must not affect the diagram. */
  }
}
