'use client';

import { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TableNode } from './table-node';
import { Table } from '@/lib/types/schema';

const nodeTypes = { table: TableNode };

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (table: Table) => void;
}

export function DiagramCanvas({ nodes: initialNodes, edges: initialEdges, onNodeClick }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.data as unknown as Table)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 2 },
        }}
      >
        <Background color="#374151" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor="#4B5563"
          maskColor="rgba(0, 0, 0, 0.5)"
          className="bg-card border border-border"
        />
      </ReactFlow>
    </div>
  );
}

