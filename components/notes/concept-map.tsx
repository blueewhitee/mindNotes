"use client"

import { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';

// Theme colors for different concept categories
const themeColors = {
  'technology': '#61dafb',
  'business': '#ffca28',
  'science': '#4caf50',
  'philosophy': '#9c27b0',
  'personal': '#f44336',
  'health': '#2196f3',
  'default': '#90a4ae'
};

export interface Concept {
  id: string;
  label: string;
  theme: string;
  importance: number;
}

export interface Relationship {
  source: string;
  target: string;
  label: string;
}

export interface ConceptMapData {
  concepts: Concept[];
  relationships: Relationship[];
}

interface ConceptMapProps {
  data: ConceptMapData;
}

export function ConceptMap({ data }: ConceptMapProps) {
  // Initialize nodes from concept data
  const initialNodes: Node[] = data.concepts.map((concept, index) => {
    // Calculate position using a circular layout
    const angle = (index / data.concepts.length) * 2 * Math.PI;
    const radius = 250;
    const x = 350 + radius * Math.cos(angle);
    const y = 250 + radius * Math.sin(angle);

    // Get color based on theme
    const color = themeColors[concept.theme as keyof typeof themeColors] || themeColors.default;
    
    // Scale node size based on importance (1-3)
    const width = 120 + (concept.importance * 10);
    const height = 40 + (concept.importance * 5);

    return {
      id: concept.id,
      data: { label: concept.label },
      position: { x, y },
      style: {
        background: color,
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '8px',
        padding: '10px',
        color: '#fff',
        border: '1px solid #555',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        fontWeight: concept.importance >= 2 ? 'bold' : 'normal',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center'
      }
    };
  });

  // Initialize edges from relationship data
  const initialEdges: Edge[] = data.relationships.map((rel, index) => ({
    id: `edge-${index}`,
    source: rel.source,
    target: rel.target,
    label: rel.label,
    type: 'smoothstep',
    animated: true,
    labelStyle: { fill: '#888', fontSize: 12 },
    style: { stroke: '#888' },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Optional: You can add layout functions here if needed
  const onLayout = useCallback((direction: string) => {
    // For future layout engine implementation
  }, []);

  return (
    <div style={{ width: '100%', height: '500px', border: '1px solid #eaeaea', borderRadius: '8px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap />
        <Background color="#f8f8f8" gap={16} />
      </ReactFlow>
    </div>
  );
}