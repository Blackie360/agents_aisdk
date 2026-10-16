import { Schema } from "../types/schema";
export interface Finding {
  id: string;
  level: "warning" | "check";
  table: string;
  title: string;
  detail: string;
}
export function reviewSchema(schema: Schema): Finding[] {
  const findings: Finding[] = [];
  const add = (
    level: Finding["level"],
    table: string,
    title: string,
    detail: string,
  ) =>
    findings.push({
      id: `review-${findings.length}`,
      level,
      table,
      title,
      detail,
    });
  for (const table of schema.tables) {
    if (table.kind === "document") {
      if (!table.columns.some((column) => column.required))
        add(
          "check",
          table.id,
          "No required properties",
          "Every top-level property is optional in the imported model. Confirm that empty documents are intended to be valid.",
        );
      continue;
    }
    if (!table.primaryKey.length)
      add(
        "warning",
        table.id,
        "No primary key declared",
        "Choose a stable column or composite key if rows need a unique identity. Keyless staging or reporting tables may be intentional.",
      );
  }
  const same = (a: string[], b: string[]) =>
    a.length === b.length && a.every((name) => b.includes(name));
  for (const relation of schema.relationships) {
    const source = schema.tables.find(
      (table) => table.id === relation.from.table,
    );
    const target = schema.tables.find(
      (table) => table.id === relation.to.table,
    );
    if (
      !source ||
      !target ||
      source.kind !== "table" ||
      target.kind !== "table"
    )
      continue;
    const label = `${relation.from.columns.join(", ")} → ${target.name} (${relation.to.columns.join(", ")})`;
    if (
      ![target.primaryKey, ...target.uniqueKeys].some((key) =>
        same(key, relation.to.columns),
      )
    )
      add(
        "warning",
        source.id,
        "Reference has no declared unique target",
        `${label}. Verify that the referenced columns form a primary or unique key. A separate unique index may not have been imported.`,
      );
    const nullable = relation.from.columns.map(
      (name) => source.columns.find((column) => column.name === name)?.nullable,
    );
    if (
      nullable.length > 1 &&
      nullable.some(Boolean) &&
      nullable.some((value) => value === false)
    )
      add(
        "check",
        source.id,
        "Composite reference mixes optional and required fields",
        `${label}. Confirm the intended null behavior; a partially null composite foreign key may bypass reference checking depending on the database and MATCH mode.`,
      );
    const covers = (keys: (string | null)[]) => {
      const leading = keys.slice(0, relation.from.columns.length);
      return (
        leading.length === relation.from.columns.length &&
        new Set(leading).size === relation.from.columns.length &&
        relation.from.columns.every((name) => leading.includes(name))
      );
    };
    const indexed = source.indexes?.some(
      (index) =>
        index.method === "btree" && !index.predicate && covers(index.columns),
    );
    const covered =
      indexed ||
      [source.primaryKey, ...source.uniqueKeys].some(covers) ||
      (relation.from.columns.length === 1 &&
        source.columns.find(
          (column) => column.name === relation.from.columns[0],
        )?.indexed);
    if (!covered)
      add(
        "check",
        source.id,
        "Check the foreign-key index",
        `${label}. No covering key is visible in the imported model. Inspect existing indexes and query plans before adding one; ordinary indexes may be omitted and some databases create them automatically.`,
      );
  }
  return findings;
}
