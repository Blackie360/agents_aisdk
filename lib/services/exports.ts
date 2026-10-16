import { Schema } from "../types/schema";
// Diagram identifiers are generated, never interpolated from untrusted schema text.
const safe = (s: string) =>
  s.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 80) || "field";
export function mermaid(schema: Schema): string {
  if (schema.tables.some((t) => t.kind === "document"))
    throw new Error(
      "Mermaid ERD export is only available for relational schemas. Use JSON for nested documents.",
    );
  const lines = [
    "erDiagram",
    "  %% Logical diagram; use JSON export for original names, compound keys and warnings.",
  ];
  schema.tables.forEach((t, i) => {
    lines.push(`  E${i}_${safe(t.name)} {`);
    t.columns.forEach((c, j) =>
      lines.push(
        `    ${safe(c.type)} f${j}_${safe(c.name)}${c.primaryKey ? " PK" : c.foreignKey ? " FK" : ""}`,
      ),
    );
    lines.push("  }");
  });
  schema.relationships.forEach((r) => {
    const i = schema.tables.findIndex((t) => t.id === r.from.table),
      j = schema.tables.findIndex((t) => t.id === r.to.table);
    const from = schema.tables[i];
    const optional = r.from.columns.some(
      (n) => from.columns.find((c) => c.name === n)?.nullable,
    );
    lines.push(
      `  E${i}_${safe(from.name)} ${r.type === "one-to-one" ? "o|" : "}o"}--${optional ? "o|" : "||"} E${j}_${safe(schema.tables[j].name)} : "${safe(r.from.columns.join("_"))}"`,
    );
  });
  return lines.join("\n");
}
