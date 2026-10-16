"use client";
import { Handle, Position } from "@xyflow/react";
import { Table } from "@/lib/types/schema";
export function TableNode({ data }: { data: Table }) {
  return (
    <div className="bg-white border border-emerald-200 rounded-xl min-w-[270px] max-w-[340px] shadow-xl overflow-hidden">
      {data.kind === "table" && (
        <Handle type="target" position={Position.Right} />
      )}
      <div className="px-4 py-3 bg-emerald-50 border-b">
        <p className="text-[10px] uppercase tracking-widest text-teal-700">
          {data.kind}
        </p>
        <strong>{data.name}</strong>
      </div>
      <div className="p-3 space-y-2">
        {data.columns.slice(0, 10).map((c) => (
          <div key={c.name} className="flex gap-3 text-xs font-mono">
            <span className="text-teal-700 w-5">
              {c.primaryKey
                ? "PK"
                : c.foreignKey
                  ? "FK"
                  : c.children
                    ? "{}"
                    : "·"}
            </span>
            <span className="truncate flex-1">{c.name}</span>
            <span className="text-slate-500 truncate max-w-[110px]">
              {c.type}
              {c.nullable ? "?" : ""}
            </span>
          </div>
        ))}
        {data.columns.length > 10 && (
          <p className="text-xs text-slate-500">
            +{data.columns.length - 10} fields — select to view all
          </p>
        )}
      </div>
      {data.kind === "table" && (
        <Handle type="source" position={Position.Left} />
      )}
    </div>
  );
}
