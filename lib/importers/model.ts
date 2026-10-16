import { Format, Schema, Table } from "../types/schema";
export const emptySchema = (database: Format): Schema => ({
  tables: [],
  relationships: [],
  warnings: [],
  metadata: { database, version: "0.2.0" },
});
export const table = (name: string): Table => ({
  id: name,
  name,
  kind: "table",
  columns: [],
  primaryKey: [],
  uniqueKeys: [],
});
export function warn(schema: Schema, message: string) {
  if (!schema.warnings.includes(message)) schema.warnings.push(message);
}
export function relation(
  schema: Schema,
  from: string,
  fields: string[],
  to: string,
  refs: string[],
) {
  if (!fields.length || fields.length !== refs.length)
    throw new Error(
      `Invalid foreign key ${from} → ${to}: column counts differ.`,
    );
  schema.relationships.push({
    id: `r${schema.relationships.length}`,
    from: { table: from, column: fields[0], columns: fields },
    to: { table: to, column: refs[0], columns: refs },
    type: "many-to-one",
  });
}
export function finalize(schema: Schema): Schema {
  if (!schema.tables.length)
    throw new Error(
      "No supported entities found. Select the correct input format.",
    );
  if (schema.tables.length > 150)
    throw new Error("Limit: 150 entities per import.");
  const ids = new Set<string>();
  for (const t of schema.tables) {
    if (ids.has(t.id)) throw new Error(`Duplicate entity: ${t.id}`);
    ids.add(t.id);
    const fields = new Set<string>();
    for (const c of t.columns) {
      if (fields.has(c.name))
        throw new Error(`Duplicate field: ${t.name}.${c.name}`);
      fields.add(c.name);
      c.primaryKey = t.primaryKey.includes(c.name);
      c.unique = t.uniqueKeys.some((k) => k.length === 1 && k[0] === c.name);
    }
    for (const k of [t.primaryKey, ...t.uniqueKeys])
      for (const f of k)
        if (!fields.has(f))
          throw new Error(`Unknown key field: ${t.name}.${f}`);
  }
  if (schema.tables.reduce((sum, t) => sum + t.columns.length, 0) > 3000)
    throw new Error("Limit: 3000 top-level fields per import.");
  schema.relationships = schema.relationships.filter((r) => {
    const from = schema.tables.find((t) => t.id === r.from.table)!;
    const to = schema.tables.find((t) => t.id === r.to.table);
    if (!to) {
      warn(
        schema,
        `Unresolved reference ${r.from.table} → ${r.to.table}; relationship omitted. Import the referenced entity too.`,
      );
      return false;
    }
    if (
      !r.from.columns.every((n) => from.columns.some((c) => c.name === n)) ||
      !r.to.columns.every((n) => to.columns.some((c) => c.name === n))
    )
      throw new Error(
        `Unknown foreign key field: ${r.from.table} → ${r.to.table}`,
      );
    const same = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x) => b.includes(x));
    r.type = [from.primaryKey, ...from.uniqueKeys].some((k) =>
      same(k, r.from.columns),
    )
      ? "one-to-one"
      : "many-to-one";
    r.from.columns.forEach((n, i) => {
      from.columns.find((c) => c.name === n)!.foreignKey = {
        table: to.id,
        column: r.to.columns[i],
      };
    });
    return true;
  });
  return JSON.parse(JSON.stringify(schema)) as Schema;
}
