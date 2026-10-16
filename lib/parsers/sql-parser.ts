import { parse, toSql } from "pgsql-ast-parser";
import sqlParser from "node-sql-parser";
const { Parser } = sqlParser;
import { emptySchema, relation, table, warn } from "../importers/model";
import { Schema } from "../types/schema";
import { postgresStatements } from "./postgres-statements";
// AST adapters intentionally keep dialect parsing separate. Never relabel PostgreSQL as MySQL.
const qualified = (n: any) =>
  [n.schema ?? n.db, n.name ?? n.table].filter(Boolean).join(".");
const names = (xs: any[] = []) => xs.map((x) => x.name ?? x.column);
export function parseSQLToSchema(
  content: string,
  dialect: "postgresql" | "mysql" | "sqlite" = "postgresql",
): Schema {
  const schema = emptySchema(dialect);
  warn(
    schema,
    "DDL structure only: index, CHECK, generated-column, referential-action and database-specific storage semantics are not modeled. This is not a migration runner.",
  );
  if (dialect === "postgresql") {
    for (const statement of postgresStatements(content)) {
      if (
        !/^create\s+(?:(?:global|local)\s+)?(?:(?:temporary|temp|unlogged)\s+)?table\b/i.test(
          statement.text.trim(),
        )
      ) {
        warn(
          schema,
          `Unsupported statement omitted: ${statement.words.slice(0, 2).join(" ") || "non-table SQL"}. Only CREATE TABLE structure is imported; migrations and procedural behavior are not applied.`,
        );
        continue;
      }
      const stmt = (parse(statement.text) as any[])[0];
      const t = table(qualified(stmt.name));
      schema.tables.push(t);
      const constraint = (c: any, fields?: string[]) => {
        const cols = fields ?? names(c.columns ?? c.localColumns);
        if (c.type === "primary key") t.primaryKey = cols;
        else if (c.type === "unique") t.uniqueKeys.push(cols);
        else if (c.type === "reference" || c.type === "foreign key")
          relation(
            schema,
            t.id,
            cols,
            qualified(c.foreignTable),
            names(c.foreignColumns),
          );
        else if (!["not null", "null", "default"].includes(c.type))
          warn(schema, `${t.id}: unsupported constraint ${c.type}.`);
      };
      for (const c of stmt.columns ?? []) {
        if (c.kind !== "column") {
          warn(schema, `${t.id}: non-column definition omitted.`);
          continue;
        }
        const d = c.constraints?.find((v: any) => v.type === "default");
        t.columns.push({
          name: c.name.name,
          type: toSql.dataType(c.dataType),
          nullable: !c.constraints?.some((v: any) =>
            ["not null", "primary key"].includes(v.type),
          ),
          primaryKey: false,
          defaultValue: d ? toSql.expr(d.default) : undefined,
        });
        for (const k of c.constraints ?? []) constraint(k, [c.name.name]);
      }
      for (const k of stmt.constraints ?? []) constraint(k);
      if (stmt.inherits)
        warn(schema, `${t.id}: inherited columns are not expanded.`);
      t.columns.forEach((c) => {
        if (t.primaryKey.includes(c.name)) c.nullable = false;
      });
    }
  } else {
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
  }
  return schema;
}
