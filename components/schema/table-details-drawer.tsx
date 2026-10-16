"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Column, Table } from "@/lib/types/schema";
function Fields({
  columns,
  document,
}: {
  columns: Column[];
  document: boolean;
}) {
  return (
    <ul className="space-y-3">
      {columns.map((c) => (
        <li key={c.name} className="border-l pl-3 py-1">
          <div className="font-mono text-sm break-all">
            {c.name} <span className="text-teal-700">{c.type}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {document
              ? c.required
                ? "Required property"
                : "Optional property"
              : c.primaryKey
                ? "Primary key member"
                : "Column"}{" "}
            · {c.nullable ? "Null allowed" : "Not nullable"}
            {c.unique ? " · Unique" : ""}
          </p>
          {c.foreignKey && (
            <p className="text-xs mt-1">
              References {c.foreignKey.table}.{c.foreignKey.column}
              {c.foreignKey.onDelete && (
                <> · ON DELETE {c.foreignKey.onDelete.toUpperCase()}</>
              )}
              {c.foreignKey.onUpdate && (
                <> · ON UPDATE {c.foreignKey.onUpdate.toUpperCase()}</>
              )}
            </p>
          )}
          {c.defaultValue !== undefined && (
            <p className="text-xs mt-1 break-all">Default: {c.defaultValue}</p>
          )}
          {c.description && <p className="text-xs mt-1">{c.description}</p>}
          {c.children && (
            <div className="mt-3">
              <Fields columns={c.children} document={document} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
export function TableDetailsDrawer({
  table,
  open,
  onClose,
}: {
  table: Table | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!table) return null;
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{table.name}</SheetTitle>
          <SheetDescription>
            {table.kind === "document"
              ? "Document properties and nested structure"
              : "Table fields and declared keys"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <Fields
            columns={table.columns}
            document={table.kind === "document"}
          />
        </div>
        {table.primaryKey.length > 0 && (
          <p className="text-xs mt-5">
            Primary key: ({table.primaryKey.join(", ")})
          </p>
        )}
        {table.uniqueKeys.map((k, i) => (
          <p className="text-xs mt-2" key={i}>
            Unique key: ({k.join(", ")})
          </p>
        ))}
        {!!table.checks?.length && (
          <section className="mt-5">
            <h3 className="text-sm font-medium">CHECK constraints</h3>
            {table.checks.map((check, i) => (
              <div key={i} className="mt-2 text-xs">
                <p>
                  {check.name ?? "Unnamed check"}
                  {check.columns.length ? ` · ${check.columns.join(", ")}` : ""}
                </p>
                <pre className="whitespace-pre-wrap break-all mt-1">
                  {check.expression}
                </pre>
              </div>
            ))}
          </section>
        )}
        {!!table.indexes?.length && (
          <section className="mt-5">
            <h3 className="text-sm font-medium">Indexes</h3>
            {table.indexes.map((index, i) => (
              <details key={i} className="mt-2 text-xs">
                <summary className="cursor-pointer">
                  {index.name} · {index.unique ? "Unique · " : ""}
                  {index.method}
                  {index.predicate ? " · Partial" : ""}
                </summary>
                <pre className="whitespace-pre-wrap break-all mt-2">
                  {index.definition}
                </pre>
              </details>
            ))}
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}
