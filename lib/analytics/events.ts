export const eventKinds = ["visualization", "explanation"] as const;
export type UsageEvent = {
  id: string;
  kind: (typeof eventKinds)[number];
  outcome: "success" | "failure";
};
export function isUsageEvent(value: unknown): value is UsageEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Object.keys(v).length === 3 &&
    typeof v.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v.id,
    ) &&
    eventKinds.includes(v.kind as UsageEvent["kind"]) &&
    (v.outcome === "success" || v.outcome === "failure")
  );
}
export type UsageSummary = {
  totals: { kind: string; outcome: string; count: number }[];
  daily: { day: string; kind: string; outcome: string; count: number }[];
  firstEvent: string | null;
};
