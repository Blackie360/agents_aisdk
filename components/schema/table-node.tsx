'use client';

import { Handle, Position } from '@xyflow/react';
import { Key, KeyRound } from 'lucide-react';
import { Table } from '@/lib/types/schema';

interface TableNodeProps {
  data: Table;
}

export function TableNode({ data }: TableNodeProps) {
  return (
    <div className="bg-card border-2 border-border rounded-lg min-w-[250px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="px-4 py-2 bg-muted font-semibold border-b border-border">
        {data.name}
      </div>
      
      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
        {data.columns.map((col) => (
          <div key={col.name} className="flex items-center gap-2 text-sm font-mono py-1">
            <div className="flex items-center gap-1">
              {col.primaryKey && <Key className="w-3 h-3 text-yellow-500" />}
              {col.foreignKey && <KeyRound className="w-3 h-3 text-blue-500" />}
            </div>
            <span className="font-medium text-foreground">{col.name}</span>
            <span className="text-muted-foreground text-xs">{col.type}</span>
            {col.nullable && (
              <span className="text-xs text-muted-foreground ml-auto">nullable</span>
            )}
          </div>
        ))}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}


