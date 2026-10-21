import sqlParser from "node-sql-parser";
import { emptySchema, relation, table, warn } from "../importers/model";
import { Schema } from "../types/schema";
const { Parser } = sqlParser;
// MySQL and SQLite via node-sql-parser. Never relabel PostgreSQL as MySQL.
const qualified = (n: any) =>
  [n.schema ?? n.db, n.name ?? n.table].filter(Boolean).join(".");
const names = (xs: any[] = []) => xs.map((x) => x.name ?? x.column);
export function parseMysqlOrSqliteToSchema(
  content: string,
  dialect: "mysql" | "sqlite",
): Schema {
  const schema = emptySchema(dialect);
  warn(
    schema,
    "DDL structure only: index, CHECK, generated-column, referential-action and database-specific storage semantics are not modeled. This is not a migration runner.",
  );
  const ast = new Parser().astify(content, {
    database: dialect === "mysql" ? "MySQL" : "SQLite",
  });
  for (const stmt of (Array.isArray(ast) ? ast : [ast]) as any[]) {
    if (stmt.type !== "create" || stmt.keyword !== "table") {
      warn(
        schema,
        `Unsupported statement omitted: ${stmt.type} ${stmt.keyword ?? ""}.`,
      );
      continue;
    }
    if (stmt.query_expr || stmt.as)
      throw new Error(
        "CREATE TABLE AS is unsupported; provide explicit column definitions.",
      );
    const t = table(qualified(stmt.table[0]));
    schema.tables.push(t);
    const reference = (ref: any, fields: string[]) =>
      relation(
        schema,
        t.id,
        fields,
        qualified(ref.table[0]),
        names(ref.definition),
      );
    for (const c of stmt.create_definitions ?? []) {
      if (c.resource === "column") {
        const name = c.column.column;
        const dt = c.definition;
        const def = c.default_val?.value;
        t.columns.push({
          name,
          type:
            dt.dataType +
            (dt.length != null
              ? `(${dt.length}${dt.scale != null ? "," + dt.scale : ""})`
              : "") +
            (dt.suffix?.length ? " " + dt.suffix.join(" ") : ""),
          nullable: c.nullable?.type !== "not null",
          primaryKey: false,
          defaultValue: def
            ? def.type === "single_quote_string"
              ? JSON.stringify(def.value)
              : String(def.value ?? JSON.stringify(def))
            : c.auto_increment
              ? "AUTO_INCREMENT"
              : undefined,
        });
        if (c.primary_key) t.primaryKey.push(name);
        if (c.unique) t.uniqueKeys.push([name]);
        if (c.reference_definition) reference(c.reference_definition, [name]);
      } else if (c.constraint_type === "PRIMARY KEY")
        t.primaryKey = names(c.definition);
      else if (
        ["UNIQUE", "UNIQUE KEY", "UNIQUE INDEX"].includes(
          c.constraint_type?.toUpperCase(),
        )
      )
        t.uniqueKeys.push(names(c.definition));
      else if (c.constraint_type === "FOREIGN KEY")
        reference(c.reference_definition, names(c.definition));
      else
        warn(
          schema,
          `${t.id}: unsupported ${c.constraint_type ?? c.resource} definition omitted.`,
        );
    }
    if (dialect === "mysql")
      t.columns.forEach((c) => {
        if (t.primaryKey.includes(c.name)) c.nullable = false;
      });
    // SQLite permits nullable non-INTEGER PRIMARY KEY values in ordinary rowid tables.
    if (dialect === "sqlite")
      t.columns.forEach((c) => {
        if (
          t.primaryKey.length === 1 &&
          t.primaryKey[0] === c.name &&
          c.type === "INTEGER"
        )
          c.nullable = false;
      });
  }
  return schema;
}
