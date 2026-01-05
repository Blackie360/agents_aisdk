export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
  defaultValue?: string;
  unique?: boolean;
  indexed?: boolean;
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  description?: string;
}

export interface Relationship {
  id: string;
  from: { table: string; column: string };
  to: { table: string; column: string };
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface Schema {
  tables: Table[];
  relationships: Relationship[];
  metadata?: {
    database?: string;
    version?: string;
  };
}

export interface DiagramNode {
  id: string;
  type: 'table';
  position: { x: number; y: number };
  data: Table;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: 'smoothstep' | 'straight';
  label?: string;
  data: Relationship;
}


