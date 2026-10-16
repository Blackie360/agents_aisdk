import { Schema, DiagramNode, DiagramEdge } from "../types/schema";
export function generateDiagram(schema: Schema): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  const height = Math.max(
    240,
    ...schema.tables.map((t) => Math.min(t.columns.length, 10) * 30 + 100),
  );
  const columns = Math.max(1, Math.ceil(Math.sqrt(schema.tables.length)));
  return {
    nodes: schema.tables.map((t, i) => ({
      id: t.id,
      type: "table",
      data: t,
      position: {
        x: (i % columns) * 400,
        y: Math.floor(i / columns) * (height + 40),
      },
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
