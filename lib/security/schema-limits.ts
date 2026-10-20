// Server-side bounds on what the Explain route will forward to an AI provider.
// Body bytes are already capped by readJson; these cap the model's shape.
export const SCHEMA_LIMITS = {
  tables: 150,
  columns: 2000,
  columnsPerTable: 300,
  relationships: 1000,
} as const;

function countColumns(columns: unknown, depth = 0): number {
  if (!Array.isArray(columns) || depth > 8) return 0;
  let total = 0;
  for (const column of columns) {
    total++;
    if (column && typeof column === "object")
      total += countColumns(
        (column as { children?: unknown }).children,
        depth + 1,
      );
  }
  return total;
}

/** Returns a user-facing message when the schema is over a limit, else null. */
export function schemaSizeError(schema: {
  tables: unknown[];
  relationships: unknown[];
}): string | null {
  if (schema.tables.length > SCHEMA_LIMITS.tables)
    return `Schemas over ${SCHEMA_LIMITS.tables} tables are too large to explain. Explain a smaller part of the schema.`;
  if (schema.relationships.length > SCHEMA_LIMITS.relationships)
    return `Schemas over ${SCHEMA_LIMITS.relationships} relationships are too large to explain. Explain a smaller part of the schema.`;
  let total = 0;
  for (const table of schema.tables) {
    const count = countColumns(
      table && typeof table === "object"
        ? (table as { columns?: unknown }).columns
        : undefined,
    );
    if (count > SCHEMA_LIMITS.columnsPerTable)
      return `Tables over ${SCHEMA_LIMITS.columnsPerTable} columns are too large to explain. Explain a smaller part of the schema.`;
    total += count;
    if (total > SCHEMA_LIMITS.columns)
      return `Schemas over ${SCHEMA_LIMITS.columns} columns are too large to explain. Explain a smaller part of the schema.`;
  }
  return null;
}
