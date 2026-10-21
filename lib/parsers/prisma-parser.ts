import { getSchema } from "@mrleebo/prisma-ast";
import {
  emptySchema,
  lineAndColumn,
  quoteToken,
  relation,
  syntaxError,
  table,
  warn,
} from "../importers/model";
import { Schema } from "../types/schema";
const arg = (attr: any, key: string) =>
  attr?.args?.find((a: any) => a.value?.key === key)?.value.value;
const fields = (v: any): string[] =>
  (v?.args ?? []).map((a: any) => (typeof a === "string" ? a : a.name));
export function parsePrismaToSchema(content: string): Schema {
  let ast;
  try {
    ast = getSchema(content);
  } catch (error: any) {
    // Chevrotain errors carry the offending token; never show their raw text.
    const token = error?.token;
    if (!token) throw error;
    const atEnd = !Number.isFinite(token.startLine);
    const where = atEnd
      ? lineAndColumn(content, content.length)
      : { line: token.startLine, column: token.startColumn };
    const found =
      !atEnd && typeof token.image === "string" && token.image
        ? quoteToken(token.image)
        : "end of input";
    const message = String(error.message ?? "");
    throw syntaxError(
      "Prisma",
      where.line,
      where.column,
      /LineBreak/.test(message)
        ? `expected a new line before ${found} (each field and block goes on its own line)`
        : `unexpected ${found}`,
    );
  }
  const schema = emptySchema("prisma");
  if (
    ast.list.some(
      (x: any) =>
        x.type === "datasource" &&
        x.assignments?.some(
          (a: any) => a.key === "provider" && a.value === '"mongodb"',
        ),
    ) ||
    ast.list.some((x: any) => x.type === "type")
  )
    throw new Error(
      "Prisma MongoDB/composite types are not supported yet. Use document JSON Schema for a nested document view.",
    );
  const models = ast.list.filter((x: any) => x.type === "model") as any[];
  const modelNames = new Set(models.map((m) => m.name));
  const enums = new Set(
    ast.list.filter((x: any) => x.type === "enum").map((x: any) => x.name),
  );
  if (enums.size)
    warn(schema, "Enum type names are preserved; enum values are not modeled.");
  for (const model of models) {
    const t = table(model.name);
    schema.tables.push(t);
    for (const f of model.properties) {
      if (f.type === "attribute") {
        if (f.name === "id") t.primaryKey = fields(f.args?.[0]?.value);
        else if (f.name === "unique")
          t.uniqueKeys.push(fields(f.args?.[0]?.value));
        else
          warn(schema, `${model.name}: @@${f.name} semantics are not modeled.`);
        continue;
      }
      if (f.type !== "field") continue;
      if (modelNames.has(f.fieldType)) {
        const rel = f.attributes?.find((a: any) => a.name === "relation");
        const local = fields(arg(rel, "fields")),
          refs = fields(arg(rel, "references"));
        if (local.length) relation(schema, t.id, local, f.fieldType, refs);
        continue; // Navigation properties are not physical columns.
      }
      const attrs = f.attributes ?? [];
      const def = attrs.find((a: any) => a.name === "default")?.args?.[0]
        ?.value;
      t.columns.push({
        name: f.name,
        type: String(f.fieldType) + (f.array ? "[]" : ""),
        nullable: !!f.optional,
        primaryKey: false,
        defaultValue:
          def === undefined
            ? undefined
            : typeof def === "object"
              ? JSON.stringify(def)
              : String(def),
      });
      if (attrs.some((a: any) => a.name === "id")) t.primaryKey.push(f.name);
      if (attrs.some((a: any) => a.name === "unique"))
        t.uniqueKeys.push([f.name]);
      for (const a of attrs)
        if (!["id", "unique", "default"].includes(a.name))
          warn(
            schema,
            `${t.id}.${f.name}: @${a.group ? a.group + "." : ""}${a.name} semantics are not modeled.`,
          );
    }
  }
  // Explicit FK relations suffice for diagrams; inverse fields need no second edge.
  for (const m of models)
    for (const f of m.properties) {
      if (f.type !== "field" || !modelNames.has(f.fieldType)) continue;
      const a = f.attributes?.find((x: any) => x.name === "relation");
      if (
        !fields(arg(a, "fields")).length &&
        !schema.relationships.some(
          (r) => r.from.table === f.fieldType && r.to.table === m.name,
        )
      )
        warn(
          schema,
          `${m.name}.${f.name}: implicit relation omitted; explicit foreign-key fields are required.`,
        );
    }
  warn(
    schema,
    "Prisma logical names are shown. Mapping/native-type semantics, indexes and relation actions are not modeled.",
  );
  return schema;
}
