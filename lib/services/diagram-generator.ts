import { Schema, DiagramNode, DiagramEdge, Table } from "../types/schema";

/** Rough rendered size of a table node (see components/schema/table-node.tsx). */
export function estimateNodeSize(t: Table) {
  const shown = t.columns.slice(0, 10);
  const longest = (pick: (c: Table["columns"][number]) => string) =>
    Math.max(0, ...shown.map((c) => pick(c).length));
  // ~7.2px per monospace character at text-xs, plus marker, gaps and padding.
  const width =
    56 +
    7.2 * longest((c) => c.name) +
    7.2 * Math.min(15, longest((c) => c.type) + 1);
  return {
    width: Math.min(340, Math.max(270, width, 40 + 8.5 * t.name.length)),
    height: 84 + 24 * shown.length + (t.columns.length > 10 ? 24 : 0),
  };
}

/** Above this, phones open on the whole-schema overview instead. */
export const NARROW_LAYOUT_MAX_TABLES = 12;

export function generateDiagram(
  schema: Schema,
  options: { narrow?: boolean } = {},
): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  let positions: { x: number; y: number }[];
  if (
    options.narrow &&
    schema.tables.length > 2 &&
    schema.tables.length <= NARROW_LAYOUT_MAX_TABLES
  ) {
    // Phones: two compact columns sized to the actual nodes, so the first
    // models stay readable (>= 50% zoom) in a narrow canvas.
    const sizes = schema.tables.map(estimateNodeSize);
    const columnWidth = Math.max(...sizes.map((s) => s.width)) + 32;
    positions = [];
    let y = 0;
    for (let i = 0; i < sizes.length; i += 2) {
      positions.push({ x: 0, y });
      if (i + 1 < sizes.length) positions.push({ x: columnWidth, y });
      y += Math.max(sizes[i].height, sizes[i + 1]?.height ?? 0) + 36;
    }
  } else {
    const height = Math.max(
      240,
      ...schema.tables.map((t) => Math.min(t.columns.length, 10) * 30 + 100),
    );
    const columns = Math.max(1, Math.ceil(Math.sqrt(schema.tables.length)));
    positions = schema.tables.map((_, i) => ({
      x: (i % columns) * 400,
      y: Math.floor(i / columns) * (height + 40),
    }));
  }
  return {
    nodes: schema.tables.map((t, i) => ({
      id: t.id,
      type: "table",
      data: t,
      position: positions[i],
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
