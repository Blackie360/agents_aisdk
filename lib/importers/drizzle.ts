import ts from "typescript";
import {
  emptySchema,
  lineAndColumn,
  relation,
  syntaxError,
  table,
  warn,
} from "./model";
import { Schema } from "../types/schema";
export function drizzle(content: string): Schema {
  const source = ts.createSourceFile(
    "schema.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const errors = (source as unknown as { parseDiagnostics: ts.Diagnostic[] })
    .parseDiagnostics;
  if (errors.length) {
    const first = errors[0];
    const { line, column } = lineAndColumn(content, first.start ?? 0);
    throw syntaxError(
      "Drizzle TypeScript",
      line,
      column,
      ts
        .flattenDiagnosticMessageText(first.messageText, " ")
        .replace(/\.$/, ""),
    );
  }
  const schema = emptySchema("drizzle");
  const aliases = new Map<string, string>();
  const builders = new Map<string, string>();
  for (const st of source.statements)
    if (
      ts.isImportDeclaration(st) &&
      ts.isStringLiteral(st.moduleSpecifier) &&
      /^drizzle-orm\/(pg|mysql|sqlite)-core$/.test(st.moduleSpecifier.text)
    ) {
      const bindings = st.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const el of bindings.elements)
          aliases.set(el.name.text, el.propertyName?.text ?? el.name.text);
    }
  const nameOf = (e: ts.Expression) =>
    ts.isIdentifier(e) ? (aliases.get(e.text) ?? "") : "";
  const definitions: { variable: string; call: ts.CallExpression }[] = [];
  for (const st of source.statements) {
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) {
        if (
          ts.isIdentifier(d.name) &&
          d.initializer &&
          ts.isCallExpression(d.initializer) &&
          ["pgTable", "mysqlTable", "sqliteTable"].includes(
            nameOf(d.initializer.expression),
          )
        ) {
          const call = d.initializer;
          if (
            !call.arguments[0] ||
            !ts.isStringLiteral(call.arguments[0]) ||
            !call.arguments[1] ||
            !ts.isObjectLiteralExpression(call.arguments[1])
          )
            throw new Error(
              "Drizzle table names and column objects must be static literals.",
            );
          builders.set(d.name.text, call.arguments[0].text);
          definitions.push({ variable: d.name.text, call });
        }
      }
  }
  for (const { call } of definitions) {
    const t = table((call.arguments[0] as ts.StringLiteral).text);
    schema.tables.push(t);
    const properties = (call.arguments[1] as ts.ObjectLiteralExpression)
      .properties;
    for (const p of properties) {
      if (
        !ts.isPropertyAssignment(p) ||
        !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
      ) {
        warn(schema, `${t.id}: spread/computed/shorthand column omitted.`);
        continue;
      }
      const name = p.name.text;
      let expr = p.initializer;
      const chain: { name: string; args: readonly ts.Expression[] }[] = [];
      while (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression)
      ) {
        chain.push({ name: expr.expression.name.text, args: expr.arguments });
        expr = expr.expression.expression;
      }
      if (!ts.isCallExpression(expr) || !nameOf(expr.expression)) {
        warn(
          schema,
          `${t.id}.${name}: unsupported dynamic column builder omitted.`,
        );
        continue;
      }
      const type = nameOf(expr.expression);
      const known = [
        "integer",
        "int",
        "smallint",
        "bigint",
        "serial",
        "smallserial",
        "bigserial",
        "text",
        "varchar",
        "char",
        "boolean",
        "timestamp",
        "datetime",
        "date",
        "time",
        "numeric",
        "decimal",
        "real",
        "doublePrecision",
        "double",
        "float",
        "json",
        "jsonb",
        "uuid",
        "blob",
        "binary",
        "varbinary",
      ];
      if (!known.includes(type)) {
        warn(schema, `${t.id}.${name}: unsupported builder ${type} omitted.`);
        continue;
      }
      const primary = chain.some((c) => c.name === "primaryKey");
      const def = chain.find((c) => c.name === "default");
      t.columns.push({
        name,
        type: type + (chain.some((c) => c.name === "array") ? "[]" : ""),
        primaryKey: primary,
        nullable: !primary && !chain.some((c) => c.name === "notNull"),
        defaultValue: def?.args[0]?.getText(source),
      });
      if (primary) t.primaryKey.push(name);
      if (chain.some((c) => c.name === "unique")) t.uniqueKeys.push([name]);
      for (const c of chain) {
        if (c.name === "references") {
          const fn = c.args[0];
          if (
            !fn ||
            !ts.isArrowFunction(fn) ||
            !ts.isPropertyAccessExpression(fn.body) ||
            !ts.isIdentifier(fn.body.expression)
          ) {
            warn(schema, `${t.id}.${name}: dynamic reference omitted.`);
            continue;
          }
          const target = builders.get(fn.body.expression.text);
          if (!target) {
            warn(
              schema,
              `${t.id}.${name}: reference target is outside this file; include its table declaration.`,
            );
            continue;
          }
          relation(schema, t.id, [name], target, [fn.body.name.text]);
        } else if (
          !["primaryKey", "notNull", "unique", "default", "array"].includes(
            c.name,
          )
        )
          warn(
            schema,
            `${t.id}.${name}: .${c.name} semantics are not modeled.`,
          );
      }
    }
    if (call.arguments.length > 2)
      warn(
        schema,
        `${t.id}: extra table configuration (compound keys/indexes/checks) is unsupported and omitted.`,
      );
  }
  warn(
    schema,
    "Drizzle static subset: named imports from pg-core/mysql-core/sqlite-core, literal tables and chained columns. Logical property names shown; SQL aliases, builder options, extra table configuration, custom types, relations() and executable/dynamic code are not evaluated.",
  );
  return schema;
}
