'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/lib/types/schema';

interface TableDetailsDrawerProps {
  table: Table | null;
  open: boolean;
  onClose: () => void;
}

export function TableDetailsDrawer({ table, open, onClose }: TableDetailsDrawerProps) {
  if (!table) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-xl">{table.name}</SheetTitle>
          {table.description && (
            <p className="text-sm text-muted-foreground mt-1">{table.description}</p>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-lg">Columns</h3>
            <div className="space-y-2">
              {table.columns.map((col) => (
                <div key={col.name} className="border-b border-border py-3 last:border-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-medium text-sm">{col.name}</span>
                    <Badge variant="secondary" className="text-xs">{col.type}</Badge>
                    {col.primaryKey && <Badge className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30">PK</Badge>}
                    {col.foreignKey && (
                      <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-500 border-blue-500/30">
                        FK → {col.foreignKey.table}.{col.foreignKey.column}
                      </Badge>
                    )}
                    {col.unique && <Badge variant="outline" className="text-xs">UNIQUE</Badge>}
                    {col.indexed && <Badge variant="outline" className="text-xs">INDEXED</Badge>}
                    {col.nullable ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">nullable</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">required</Badge>
                    )}
                  </div>
                  {col.defaultValue && (
                    <div className="mt-1 text-xs text-muted-foreground font-mono">
                      Default: {col.defaultValue}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-lg">AI Insights</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>This table stores {table.name === 'users' ? 'user account information' : table.name === 'posts' ? 'blog post content' : 'comment data'}.</span>
              </li>
              {table.columns.some(col => col.foreignKey) && (
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    Related to{' '}
                    {table.columns
                      .filter(col => col.foreignKey)
                      .map(col => col.foreignKey!.table)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(', ')}{' '}
                    through foreign key relationships.
                  </span>
                </li>
              )}
              {table.columns.some(col => col.indexed) ? (
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Indexes are present for optimized query performance.</span>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Consider adding indexes on frequently queried columns for better performance.</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

