export type Format =
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "prisma"
  | "typeorm"
  | "json-schema"
  | "drizzle";
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
    unresolved?: boolean;
    onDelete?: string;
    onUpdate?: string;
  };
  defaultValue?: string;
  unique?: boolean;
  indexed?: boolean;
  children?: Column[];
  description?: string;
  required?: boolean;
}
export interface Table {
  [key: string]: unknown;
  id: string;
  name: string;
  kind: "table" | "document";
  columns: Column[];
  description?: string;
  indexes?: {
    name: string;
    unique: boolean;
    method: string;
    columns: (string | null)[];
    definition: string;
    predicate?: string;
  }[];
  checks?: { name?: string; expression: string; columns: string[] }[];
  primaryKey: string[];
  uniqueKeys: string[][];
}
export interface Relationship {
  onDelete?: string;
  onUpdate?: string;
  [key: string]: unknown;
  id: string;
  from: { table: string; column: string; columns: string[] };
  to: { table: string; column: string; columns: string[] };
  type: "one-to-one" | "many-to-one";
}
export interface Schema {
  tables: Table[];
  relationships: Relationship[];
  warnings: string[];
  metadata: { database: Format; version: string };
}
export interface DiagramNode {
  id: string;
  type: "table";
  position: { x: number; y: number };
  data: Table;
}
export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: "smoothstep";
  label: string;
  data: Relationship;
}
