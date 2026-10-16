import { Column, Schema } from "../types/schema";
import { emptySchema, relation, table, warn } from "./model";
function object(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function typeorm(content: string): Schema {
  const schema = emptySchema("typeorm");
  const input = JSON.parse(content);
  const entities = Array.isArray(input) ? input : [input];
  for (const e of entities) {
    if (!object(e) || typeof e.name !== "string" || !object(e.columns))
      throw new Error(
        "Expected TypeORM EntitySchema JSON options with name and columns. Executable source is unsupported.",
      );
    const t = table(e.name);
    schema.tables.push(t);
    for (const [name, c] of Object.entries(e.columns) as [string, any][]) {
      if (!object(c) || typeof c.type !== "string")
        throw new Error(`${e.name}.${name}: column type must be a string.`);
      t.columns.push({
        name,
        type:
          c.type +
          (c.length != null ? `(${c.length})` : "") +
          (c.array ? "[]" : ""),
        primaryKey: false,
        nullable: !c.primary && c.nullable === true,
        defaultValue:
          c.default === undefined ? undefined : JSON.stringify(c.default),
      });
      if (c.primary) t.primaryKey.push(name);
      if (c.unique) t.uniqueKeys.push([name]);
      for (const key of Object.keys(c))
        if (
          ![
            "type",
            "length",
            "array",
            "primary",
            "nullable",
            "default",
            "unique",
          ].includes(key)
        )
          warn(schema, `${e.name}.${name}: ${key} semantics are not modeled.`);
    }
    for (const u of e.uniques ?? []) {
      if (
        !Array.isArray(u.columns) ||
        !u.columns.every((x: unknown) => typeof x === "string")
      )
        throw new Error("TypeORM unique columns must be string arrays.");
      t.uniqueKeys.push(u.columns);
    }
    for (const [name, r] of Object.entries(e.relations ?? {}) as [
      string,
      any,
    ][]) {
      if (
        !object(r) ||
        !["many-to-one", "one-to-one"].includes(r.type) ||
        typeof r.target !== "string" ||
        !r.joinColumn ||
        r.joinColumn === true
      ) {
        warn(
          schema,
          `${e.name}.${name}: relation omitted; only owning one-to-one/many-to-one with explicit joinColumn fields are supported.`,
        );
        continue;
      }
      const joins = Array.isArray(r.joinColumn) ? r.joinColumn : [r.joinColumn];
      if (
        !joins.every(
          (j: any) =>
            typeof j.name === "string" &&
            typeof j.referencedColumnName === "string",
        )
      )
        throw new Error(
          `${e.name}.${name}: explicit join column and referencedColumnName required.`,
        );
      if (r.type === "one-to-one")
        t.uniqueKeys.push(joins.map((j: any) => j.name));
      relation(
        schema,
        t.id,
        joins.map((j: any) => j.name),
        r.target,
        joins.map((j: any) => j.referencedColumnName),
      );
    }
    for (const key of Object.keys(e))
      if (!["name", "columns", "relations", "uniques"].includes(key))
        warn(schema, `${e.name}: ${key} semantics are not modeled.`);
  }
  warn(
    schema,
    "TypeORM logical property names are shown. Join columns must already exist in columns; no code is executed or implicit columns generated.",
  );
  return schema;
}
export function jsonSchema(content: string): Schema {
  const root = JSON.parse(content);
  const schema = emptySchema("json-schema");
  if (!object(root) || !object(root.properties))
    throw new Error(
      "Expected a document JSON Schema object with properties. Raw documents and MongoDB validators are not supported.",
    );
  let count = 0;
  function inspect(node: any, path: string) {
    if (!object(node))
      throw new Error(`${path}: boolean schemas are unsupported.`);
    for (const key of Object.keys(node))
      if (
        ![
          "$schema",
          "$id",
          "title",
          "type",
          "properties",
          "required",
          "items",
          "description",
          "default",
        ].includes(key)
      )
        warn(schema, `${path}: ${key} is not expanded or validated.`);
  }
  function columns(node: any, path: string, depth: number): Column[] {
    if (depth > 20) throw new Error("Document nesting exceeds 20 levels.");
    inspect(node, path);
    if (
      node.required !== undefined &&
      (!Array.isArray(node.required) ||
        !node.required.every((x: unknown) => typeof x === "string"))
    )
      throw new Error(`${path}: required must be a string array.`);
    return Object.entries(node.properties ?? {}).map(
      ([name, n]: [string, any]) => {
        if (++count > 3000) throw new Error("Limit: 3000 document fields.");
        const p = `${path}.${name}`;
        inspect(n, p);
        const types = Array.isArray(n.type)
          ? n.type
          : [n.type ?? (n.properties ? "object" : "unspecified")];
        let children: Column[] | undefined;
        if (n.properties) children = columns(n, p, depth + 1);
        if (n.items) {
          inspect(n.items, p + "[]");
          if (n.items.properties)
            children = columns(n.items, p + "[]", depth + 1);
          if (n.items.items)
            warn(schema, `${p}: nested array items are not expanded.`);
        }
        return {
          name,
          type:
            types.join(" | ") +
            (n.items
              ? `<${Array.isArray(n.items.type) ? n.items.type.join(" | ") : (n.items.type ?? "unspecified")}>`
              : ""),
          nullable: types.includes("null"),
          required: (node.required ?? []).includes(name),
          primaryKey: false,
          children,
          description:
            typeof n.description === "string" ? n.description : undefined,
          defaultValue:
            n.default === undefined ? undefined : JSON.stringify(n.default),
        };
      },
    );
  }
  const t = table(typeof root.title === "string" ? root.title : "Document");
  t.kind = "document";
  t.columns = columns(root, t.name, 0);
  t.description = root.description;
  schema.tables.push(t);
  warn(
    schema,
    "Document structure view: required means property presence; nullable means null is allowed. No foreign keys are inferred. Validation constraints and references are not evaluated.",
  );
  return schema;
}
