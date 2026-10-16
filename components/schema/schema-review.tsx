"use client";
import { useMemo } from "react";
import { Schema, Table } from "@/lib/types/schema";
import { reviewSchema } from "@/lib/review/schema-review";
export function SchemaReview({
  schema,
  onSelect,
}: {
  schema: Schema;
  onSelect: (table: Table) => void;
}) {
  const findings = useMemo(() => reviewSchema(schema), [schema]);
  const warnings = findings.filter(
    (finding) => finding.level === "warning",
  ).length;
  return (
    <section
      aria-label="Schema review"
      className="mx-5 md:mx-10 mt-5 border rounded-xl p-4"
    >
      <div className="flex justify-between gap-3 items-center">
        <h2 className="font-medium">Schema review</h2>
        <span className="text-xs text-muted-foreground">
          {warnings} warnings · {findings.length - warnings} checks
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Automatic · Local · No API key needed
      </p>
      {findings.length ? (
        <ul className="mt-4 grid md:grid-cols-2 gap-3">
          {findings.map((finding) => {
            const table = schema.tables.find(
              (table) => table.id === finding.table,
            )!;
            return (
              <li key={finding.id} className="border rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      finding.level === "warning"
                        ? "text-amber-800 text-xs"
                        : "text-teal-800 text-xs"
                    }
                  >
                    {finding.level === "warning" ? "Warning" : "Check"}
                  </span>
                  <button
                    className="underline text-xs"
                    onClick={() => onSelect(table)}
                    aria-label={`Inspect ${table.name}: ${finding.title}`}
                  >
                    {table.name}
                  </button>
                </div>
                <h3 className="font-medium mt-2">{finding.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {finding.detail}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm mt-4">
          No findings from these checks. This is not a full database audit.
        </p>
      )}
      <details className="text-xs text-muted-foreground mt-4">
        <summary className="cursor-pointer">What this review checks</summary>
        <p className="mt-2 leading-relaxed">
          Relational models: declared primary keys, unique reference targets,
          composite foreign-key nullability and possible index gaps. Document
          models: required top-level properties. Only imported structures are
          reviewed; ignored syntax, indexes, data, workload, permissions and
          migration safety are not validated. Review import notes before acting.
          Type compatibility is not inferred across database or ORM type
          systems.
        </p>
        {schema.warnings.length > 0 && (
          <p className="mt-2">
            This import has {schema.warnings.length} notes that may limit the
            review.
          </p>
        )}
      </details>
    </section>
  );
}
