'use client';

import { SchemaInput } from '@/components/schema/schema-input';
import { DiagramCanvas } from '@/components/schema/diagram-canvas';
import { TableDetailsDrawer } from '@/components/schema/table-details-drawer';
import { AIExplanationPanel } from '@/components/schema/ai-explanation-panel';
import { useSchemaVisualization } from '@/lib/hooks/use-schema-visualization';

export default function HomePage() {
  const {
    isLoading,
    isStreaming,
    explanation,
    diagram,
    selectedTable,
    setSelectedTable,
    generateFromSchema,
  } = useSchemaVisualization();

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 bg-card">
        <h1 className="text-2xl font-bold">SchemaMind</h1>
        <p className="text-sm text-muted-foreground">
          Visualize and understand your database with AI
        </p>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
        {/* Left Panel */}
        <div className="space-y-6 overflow-y-auto">
          <SchemaInput onGenerate={generateFromSchema} isLoading={isLoading} />
          <AIExplanationPanel explanation={explanation} isStreaming={isStreaming} />
        </div>

        {/* Right Panel */}
        <div className="h-full min-h-0">
          {diagram ? (
            <DiagramCanvas
              nodes={diagram.nodes}
              edges={diagram.edges}
              onNodeClick={setSelectedTable}
            />
          ) : (
            <div className="h-full flex items-center justify-center border border-border rounded-xl bg-card">
              <p className="text-muted-foreground text-center px-4">
                Paste a schema to see your database come to life
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Table Details Drawer */}
      <TableDetailsDrawer
        table={selectedTable}
        open={!!selectedTable}
        onClose={() => setSelectedTable(null)}
      />
    </div>
  );
}

