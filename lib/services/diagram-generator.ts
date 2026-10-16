import { Schema, DiagramNode, DiagramEdge } from "../types/schema";
export function generateDiagram(schema: Schema): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  const height = Math.max(
    240,
    ...schema.tables.map((t) => Math.min(t.columns.length, 10) * 30 + 100),
  );
  return {
    nodes: schema.tables.map((t, i) => ({
      id: t.id,
      type: "table",
      data: t,
      position: { x: (i % 3) * 380, y: Math.floor(i / 3) * height },
    })),
    edges: schema.relationships.map((r) => ({
      id: r.id,
      source: r.from.table,
      target: r.to.table,
      type: "smoothstep",
      label: r.type === "one-to-one" ? "1:1" : "N:1",
      data: r,
    })),
  };
}
