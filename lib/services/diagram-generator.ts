import { Schema, DiagramNode, DiagramEdge } from '@/lib/types/schema';

export function generateDiagram(schema: Schema): {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
} {
  // Auto-layout algorithm using dagre or manual positioning
  const nodes: DiagramNode[] = schema.tables.map((table, index) => ({
    id: table.id,
    type: 'table',
    position: { x: (index % 3) * 350, y: Math.floor(index / 3) * 300 },
    data: table,
  }));

  const edges: DiagramEdge[] = schema.relationships.map(rel => ({
    id: rel.id,
    source: rel.from.table,
    target: rel.to.table,
    type: 'smoothstep',
    label: rel.type,
    data: rel,
  }));

  return { nodes, edges };
}


