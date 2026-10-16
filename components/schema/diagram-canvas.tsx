"use client";

import { useEffect, useState } from "react";
import {
  ReactFlow,
  MarkerType,
  Background,
  Controls,
  Panel,
  ReactFlowInstance,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TableNode } from "./table-node";
import { Table } from "@/lib/types/schema";

const fitOptions = { padding: 0.25, minZoom: 0.02, maxZoom: 1 };
const nodeTypes = { table: TableNode };

interface DiagramCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (table: Table) => void;
}

export function DiagramCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeClick,
}: DiagramCanvasProps) {
  const [expanded, setExpanded] = useState(false);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focused, setFocused] = useState("");
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);
  useEffect(() => {
    if (!flow) return;
    const frame = requestAnimationFrame(() => {
      void flow.fitView({ ...fitOptions, duration: 300 });
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded, flow]);
  const fitToScreen = () => {
    setFocused("");
    setExpanded(true);
    if (expanded) void flow?.fitView({ ...fitOptions, duration: 300 });
  };
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-50 rounded-xl overflow-hidden border border-border bg-background shadow-2xl"
          : "w-full h-full rounded-xl overflow-hidden border border-border bg-background"
      }
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick(node.data as unknown as Table)}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        deleteKeyCode={null}
        onInit={setFlow}
        onMove={(_, viewport) => setZoom(viewport.zoom)}
        minZoom={0.02}
        maxZoom={2.5}
        fitView
        fitViewOptions={fitOptions}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: false,
          style: { strokeWidth: 2 },
        }}
      >
        <Background color="#ced8cf" gap={16} />
        <Panel
          position="top-left"
          className="flex flex-wrap items-center gap-2 bg-white border rounded-lg p-2 shadow-sm text-sm"
        >
          <select
            aria-label="Find table in diagram"
            value={focused}
            className="max-w-[160px] bg-white"
            onChange={(event) => {
              const id = event.target.value;
              setFocused(id);
              if (id)
                void flow?.fitView({
                  nodes: [{ id }],
                  padding: 0.4,
                  minZoom: 0.3,
                  maxZoom: 1.2,
                  duration: 300,
                });
            }}
          >
            <option value="">Find table…</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {String(node.data.name)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setFocused("");
              void flow?.fitView({ ...fitOptions, duration: 300 });
            }}
          >
            Fit all
          </button>
          <span aria-label="Diagram zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => (expanded ? setExpanded(false) : fitToScreen())}
          >
            {expanded ? "Close expanded view" : "Fit to screen"}
          </button>
        </Panel>
        <Controls
          fitViewOptions={fitOptions}
          onFitView={fitToScreen}
          showInteractive={false}
        />
        <MiniMap
          pannable
          zoomable
          style={{ width: 120, height: 80 }}
          nodeColor="#8bb6a0"
          maskColor="rgba(235, 242, 235, 0.7)"
          className="bg-card border border-border"
        />
      </ReactFlow>
    </div>
  );
}
