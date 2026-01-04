'use client';

import { useState } from 'react';
import { SchemaInput } from '@/components/schema/schema-input';
import { DiagramCanvas } from '@/components/schema/diagram-canvas';
import { TableDetailsDrawer } from '@/components/schema/table-details-drawer';
import { AIExplanationPanel } from '@/components/schema/ai-explanation-panel';
import { generateDiagram } from '@/lib/services/diagram-generator';
import { Table } from '@/lib/types/schema';
import { Node, Edge } from '@xyflow/react';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [diagram, setDiagram] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [explanation, setExplanation] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleGenerate = async (input: string) => {
    setIsLoading(true);
    setIsStreaming(true);
    setExplanation('');
    setSelectedTable(null);
    
    try {
      // Parse schema with auto-detection
      const response = await fetch('/api/schema-visualizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schema: input }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to parse schema');
      }

      const data = await response.json();
      
      if (!data.success || !data.schema) {
        throw new Error(data.message || 'Failed to parse schema');
      }

      // Generate diagram from parsed schema
      const diagramData = generateDiagram(data.schema);
      setDiagram({
        nodes: diagramData.nodes as unknown as Node[],
        edges: diagramData.edges as unknown as Edge[],
      });

      // Stream AI explanation
      const explanationResponse = await fetch('/api/schema-explanation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schema: data.schema }),
      });

      if (explanationResponse.ok && explanationResponse.body) {
        const reader = explanationResponse.body.getReader();
        const decoder = new TextDecoder();
        let fullExplanation = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('0:')) {
              const text = line.substring(2).replace(/^"(.+)"$/, '$1');
              fullExplanation += text;
              setExplanation(fullExplanation);
            }
          }
        }
      }
      
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

