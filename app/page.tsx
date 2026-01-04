'use client';

import { useState } from 'react';
import { SchemaInput } from '@/components/schema/schema-input';
import { DiagramCanvas } from '@/components/schema/diagram-canvas';
import { TableDetailsDrawer } from '@/components/schema/table-details-drawer';
import { AIExplanationPanel } from '@/components/schema/ai-explanation-panel';
import { parseSchemaWithExplanation } from '@/lib/services/schema-parser';
import { generateDiagram } from '@/lib/services/diagram-generator';
import { Table } from '@/lib/types/schema';
import { Node, Edge } from '@xyflow/react';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [diagram, setDiagram] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleGenerate = async (input: string, type: 'prisma' | 'sql' | 'connection') => {
    setIsLoading(true);
    setIsStreaming(true);
    setExplanation('');
    setSelectedTable(null);
    
    try {
      // Parse schema and stream explanation in one API call
      let fullExplanation = '';
      const schema = await parseSchemaWithExplanation(input, type, (chunk) => {
        fullExplanation += chunk;
        setExplanation(fullExplanation);
      });
      
      // Generate diagram from parsed schema
      const diagramData = generateDiagram(schema);
      setDiagram({
        nodes: diagramData.nodes as unknown as Node[],
        edges: diagramData.edges as unknown as Edge[],
      });
      
      setIsStreaming(false);
    } catch (error) {
      console.error('Failed to generate diagram:', error);
      setExplanation(`Error: ${error instanceof Error ? error.message : 'Failed to generate diagram. Please check your schema format.'}`);
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  };

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
          <SchemaInput onGenerate={handleGenerate} isLoading={isLoading} />
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

