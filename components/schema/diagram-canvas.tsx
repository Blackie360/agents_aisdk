"use client";

import { useEffect, useRef, useState } from "react";
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
import { NARROW_LAYOUT_MAX_TABLES } from "@/lib/services/diagram-generator";

const defaultFitOptions = { padding: 0.25, minZoom: 0.02, maxZoom: 1 };
const smallFitOptions = { padding: 0.2, minZoom: 0.02, maxZoom: 1.8 };
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
  const container = useRef<HTMLDivElement>(null);
  const fitOptions =
    initialNodes.length <= 2 ? smallFitOptions : defaultFitOptions;
  // Narrow canvases (phones) open on the first models at a readable zoom
  // instead of shrinking the whole schema to an unreadable overview.
  const openingFit = (width: number) =>
    width < 640 &&
    initialNodes.length > 4 &&
    initialNodes.length <= NARROW_LAYOUT_MAX_TABLES
      ? {
          nodes: initialNodes.slice(0, 4).map((n) => ({ id: n.id })),
          padding: 0.06,
          minZoom: 0.5,
          maxZoom: 1,
        }
      : fitOptions;
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
    if (!flow || !container.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const fit = () => {
      clearTimeout(timer);
      // Let React Flow observe the new viewport before calculating its center.
      timer = setTimeout(() => {
        const width = container.current?.clientWidth ?? 1024;
        void flow.fitView({
          ...(expanded ? fitOptions : openingFit(width)),
          duration: 300,
        });
      }, 60);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container.current);
    fit();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [expanded, flow, fitOptions]);
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
      ref={container}
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
        fitViewOptions={openingFit(
          typeof window === "undefined" ? 1024 : window.innerWidth,
        )}
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
