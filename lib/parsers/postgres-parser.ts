import { parse, toSql } from "pgsql-ast-parser";
import { emptySchema, relation, table, warn } from "../importers/model";
import { Schema } from "../types/schema";
import { postgresStatements } from "./postgres-statements";
// PostgreSQL only. Kept apart from MySQL/SQLite so the browser loads one parser.
const qualified = (n: any) =>
  [n.schema ?? n.db, n.name ?? n.table].filter(Boolean).join(".");
const names = (xs: any[] = []) => xs.map((x) => x.name ?? x.column);
export function parsePostgresToSchema(content: string): Schema {
  const schema = emptySchema("postgresql");
  warn(
    schema,
    "PostgreSQL table definitions, parsed indexes, CHECK expressions and foreign-key actions are described, not executed. Generated columns, storage semantics and procedural behavior are not modeled.",
  );
  const indexes: any[] = [];
  for (const statement of postgresStatements(content)) {
    if (/^create\s+(?:unique\s+)?index\b/i.test(statement.text.trim())) {
      try {
        indexes.push({
          ast: (parse(statement.text) as any[])[0],
          definition: statement.text,
        });
      } catch {
        warn(
          schema,
          "Index definition could not be parsed and was omitted; index review may be incomplete.",
        );
      }
      continue;
    }
    if (
      !/^create\s+(?:(?:global|local)\s+)?(?:(?:temporary|temp|unlogged)\s+)?table\b/i.test(
        statement.text.trim(),
      )
    ) {
      warn(
        schema,
        `Unsupported statement omitted: ${statement.words.slice(0, 2).join(" ") || "non-table SQL"}. Only supported table and index definitions are imported; migrations and procedural behavior are not applied.`,
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
      else if (c.type === "check") {
        (t.checks ??= []).push({
          name: c.constraintName?.name,
          expression: toSql.expr(c.expr),
          columns: fields ?? [],
        });
      } else if (c.type === "reference" || c.type === "foreign key") {
        relation(
          schema,
          t.id,
          cols,
          qualified(c.foreignTable),
          names(c.foreignColumns),
        );
        Object.assign(schema.relationships.at(-1)!, {
          onDelete: c.onDelete ?? "no action",
          onUpdate: c.onUpdate ?? "no action",
        });
      } else if (!["not null", "null", "default"].includes(c.type))
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
  for (const { ast, definition } of indexes) {
    const t = schema.tables.find((t) => t.id === qualified(ast.table));
    if (!t) {
      warn(
        schema,
        `Index ${ast.indexName?.name ?? "(unnamed)"}: target table not imported; index omitted.`,
      );
      continue;
    }
    const columns = ast.expressions.map((item: any) =>
      item.expression.type === "ref" ? item.expression.name : null,
    );
    if (
      columns.some(
        (name: string | null) =>
          name && !t.columns.some((c) => c.name === name),
      )
    ) {
      warn(
        schema,
        `Index ${ast.indexName?.name ?? "(unnamed)"}: unknown column; index omitted.`,
      );
      continue;
    }
    const method = ast.using?.name ?? "btree";
    (t.indexes ??= []).push({
      name: ast.indexName?.name ?? "Unnamed index",
      unique: !!ast.unique,
      method,
      columns,
      definition,
      predicate: ast.where ? toSql.expr(ast.where) : undefined,
    });
    if (
      ast.unique &&
      !ast.where &&
      method === "btree" &&
      columns.length &&
      columns.every((name: string | null) => name !== null)
    )
      t.uniqueKeys.push(columns);
  }
  return schema;
}
