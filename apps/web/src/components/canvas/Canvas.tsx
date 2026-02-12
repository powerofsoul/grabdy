import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { Maximize2, Minimize2, MousePointerClick } from 'lucide-react';
import {
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  Panel,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import type { CanvasEdge, Card } from '@grabdy/contracts';

import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasToolbar } from './CanvasToolbar';
import { CardNode } from './CardNode';
import { CustomEdge } from './CustomEdge';

const COLLISION_PADDING = 12;

/**
 * Given two nodes, compute the best side (handle) for source and target
 * so the edge connects from the closest sides.
 */
function bestHandles(
  sourceNode: Node,
  targetNode: Node,
): { sourceHandle: string; targetHandle: string } {
  const sw = sourceNode.measured?.width ?? sourceNode.width ?? 400;
  const sh = sourceNode.measured?.height ?? sourceNode.height ?? 300;
  const tw = targetNode.measured?.width ?? targetNode.width ?? 400;
  const th = targetNode.measured?.height ?? targetNode.height ?? 300;

  const sCx = sourceNode.position.x + sw / 2;
  const sCy = sourceNode.position.y + sh / 2;
  const tCx = targetNode.position.x + tw / 2;
  const tCy = targetNode.position.y + th / 2;

  const dx = tCx - sCx;
  const dy = tCy - sCy;

  // Pick based on which axis has the larger delta
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal — source exits right, target enters left (or vice versa)
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }
  // Vertical
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
}

interface ContextMenuState {
  nodeId: string;
  x: number;
  y: number;
}

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onDeleteCard: (cardId: string) => void;
  onMoveCard: (cardId: string, position: { x: number; y: number }) => void;
  onEdgesChange: (edges: CanvasEdge[]) => void;
  onComponentEdit?: (cardId: string, componentId: string, data: Record<string, unknown>) => void;
  onLockToggle?: (cardId: string) => void;
  onTitleEdit?: (cardId: string, title: string) => void;
  onAddCard?: (card: Card) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

const NODE_TYPES = { card: CardNode };
const EDGE_TYPES = { custom: CustomEdge };
const DEFAULT_EDGE_OPTIONS = { type: 'custom' };
const FIT_VIEW_OPTIONS = { padding: 0.3, duration: 500 };
const DUPLICATE_OFFSET = 30;

export function Canvas({
  nodes: externalNodes,
  edges: externalEdges,
  onDeleteCard,
  onMoveCard,
  onEdgesChange: onEdgesChangeProp,
  onComponentEdit,
  onLockToggle,
  onTitleEdit,
  onAddCard,
  isMaximized,
  onToggleMaximize,
}: CanvasProps) {
  const theme = useTheme();
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const prevNodeCount = useRef(0);

  const isEmpty = externalNodes.length === 0;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Inject callbacks into each node's data
  const nodesWithCallbacks = useMemo(
    (): Node[] =>
      externalNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: () => onDeleteCard(node.id),
          onLockToggle,
          onComponentEdit,
          onTitleEdit,
        },
      })),
    [externalNodes, onDeleteCard, onLockToggle, onComponentEdit, onTitleEdit],
  );

  // ReactFlow manages local node state (smooth dragging)
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithCallbacks);
  const [localEdges, setLocalEdges, handleEdgesChange] = useEdgesState(externalEdges);

  // Sync external node changes (new cards, deletions) into local state
  useEffect(() => {
    setNodes(nodesWithCallbacks);
  }, [nodesWithCallbacks, setNodes]);

  // Sync external edge changes into local state
  useEffect(() => {
    setLocalEdges(externalEdges);
  }, [externalEdges, setLocalEdges]);

  // Inject onEdgeDataChange callback ref (set after handleEdgeDataChange is defined)
  const edgeDataChangeRef = useRef<(edgeId: string, data: Record<string, unknown>) => void>();

  // Debounce edge saves to backend
  const edgeSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const edgesToCanvasEdges = useCallback((rfEdges: Edge[]): CanvasEdge[] => {
    return rfEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : undefined,
      strokeWidth: typeof e.data?.strokeWidth === 'number' ? e.data.strokeWidth : 2,
    }));
  }, []);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Prevent self-connections and duplicate edges
      if (connection.source === connection.target) return;

      setLocalEdges((prev) => {
        // Check for existing edge between same nodes (either direction)
        const exists = prev.some(
          (e) =>
            (e.source === connection.source && e.target === connection.target) ||
            (e.source === connection.target && e.target === connection.source),
        );
        if (exists) return prev;

        // Store as card-to-card — no handle IDs (computed dynamically)
        const newEdge: Edge = {
          id: `e-${connection.source}-${connection.target}`,
          type: 'custom',
          source: connection.source,
          target: connection.target,
          data: { strokeWidth: 2 },
        };
        const updated = [...prev, newEdge];
        clearTimeout(edgeSaveTimer.current);
        edgeSaveTimer.current = setTimeout(() => {
          onEdgesChangeProp(edgesToCanvasEdges(updated));
        }, 500);
        return updated;
      });
    },
    [onEdgesChangeProp, setLocalEdges, edgesToCanvasEdges],
  );

  const onLocalEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      handleEdgesChange(changes);
      const hasRemoval = changes.some((c) => c.type === 'remove');
      if (hasRemoval) {
        clearTimeout(edgeSaveTimer.current);
        edgeSaveTimer.current = setTimeout(() => {
          setLocalEdges((current) => {
            onEdgesChangeProp(edgesToCanvasEdges(current));
            return current;
          });
        }, 500);
      }
    },
    [handleEdgesChange, onEdgesChangeProp, setLocalEdges, edgesToCanvasEdges],
  );

  // Called by CustomEdge when arrow/stroke properties change
  const handleEdgeDataChange = useCallback(
    (edgeId: string, newData: Record<string, unknown>) => {
      setLocalEdges((prev) => {
        const updated = prev.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, ...newData } } : e,
        );
        clearTimeout(edgeSaveTimer.current);
        edgeSaveTimer.current = setTimeout(() => {
          onEdgesChangeProp(edgesToCanvasEdges(updated));
        }, 500);
        return updated;
      });
    },
    [onEdgesChangeProp, setLocalEdges, edgesToCanvasEdges],
  );

  edgeDataChangeRef.current = handleEdgeDataChange;

  // Compute best handles + inject callbacks into edge data
  const edgesWithCallbacks = useMemo((): Edge[] => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return localEdges.map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const handles = sourceNode && targetNode ? bestHandles(sourceNode, targetNode) : { sourceHandle: 'right', targetHandle: 'left' };
      return {
        ...edge,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        data: {
          ...edge.data,
          onEdgeDataChange: (newData: Record<string, unknown>) => {
            edgeDataChangeRef.current?.(edge.id, newData);
          },
        },
      };
    });
  }, [localEdges, nodes]);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance;
    if (externalNodes.length > 0) {
      instance.fitView(FIT_VIEW_OPTIONS);
    }
  }, [externalNodes.length]);

  // Track node count (no auto-zoom on new cards)
  useEffect(() => {
    prevNodeCount.current = externalNodes.length;
  }, [externalNodes.length]);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      // Resolve collisions: nudge dragged node so it doesn't overlap others
      const dragged = node;
      const dw = (dragged.measured?.width ?? dragged.width ?? 400);
      const dh = (dragged.measured?.height ?? dragged.height ?? 300);
      let { x, y } = dragged.position;

      for (const other of nodes) {
        if (other.id === dragged.id) continue;
        const ow = (other.measured?.width ?? other.width ?? 400);
        const oh = (other.measured?.height ?? other.height ?? 300);

        // AABB overlap check with padding
        const overlapX = x < other.position.x + ow + COLLISION_PADDING && x + dw + COLLISION_PADDING > other.position.x;
        const overlapY = y < other.position.y + oh + COLLISION_PADDING && y + dh + COLLISION_PADDING > other.position.y;

        if (overlapX && overlapY) {
          // Find the smallest nudge direction
          const nudgeRight = other.position.x + ow + COLLISION_PADDING - x;
          const nudgeLeft = x + dw + COLLISION_PADDING - other.position.x;
          const nudgeDown = other.position.y + oh + COLLISION_PADDING - y;
          const nudgeUp = y + dh + COLLISION_PADDING - other.position.y;
          const min = Math.min(nudgeRight, nudgeLeft, nudgeDown, nudgeUp);

          if (min === nudgeRight) x += nudgeRight;
          else if (min === nudgeLeft) x -= nudgeLeft;
          else if (min === nudgeDown) y += nudgeDown;
          else y -= nudgeUp;
        }
      }

      // If position changed due to collision, update the node visually
      if (x !== dragged.position.x || y !== dragged.position.y) {
        setNodes((prev) =>
          prev.map((n) => (n.id === dragged.id ? { ...n, position: { x, y } } : n)),
        );
      }

      onMoveCard(node.id, { x, y });
    },
    [nodes, onMoveCard, setNodes],
  );

  // Right-click context menu on nodes
  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    },
    [],
  );

  // Prevent default context menu on canvas pane
  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu actions
  const handleContextDelete = useCallback(() => {
    if (contextMenu) onDeleteCard(contextMenu.nodeId);
  }, [contextMenu, onDeleteCard]);

  const handleContextLockToggle = useCallback(() => {
    if (contextMenu) onLockToggle?.(contextMenu.nodeId);
  }, [contextMenu, onLockToggle]);

  const handleBringToFront = useCallback(() => {
    if (!contextMenu) return;
    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex ?? 0), 0);
    setNodes((prev) =>
      prev.map((n) => (n.id === contextMenu.nodeId ? { ...n, zIndex: maxZ + 1 } : n)),
    );
  }, [contextMenu, nodes, setNodes]);

  const handleSendToBack = useCallback(() => {
    if (!contextMenu) return;
    const minZ = nodes.reduce((min, n) => Math.min(min, n.zIndex ?? 0), 0);
    setNodes((prev) =>
      prev.map((n) => (n.id === contextMenu.nodeId ? { ...n, zIndex: minZ - 1 } : n)),
    );
  }, [contextMenu, nodes, setNodes]);

  const handleDuplicate = useCallback(() => {
    if (!contextMenu || !onAddCard) return;
    const sourceNode = externalNodes.find((n) => n.id === contextMenu.nodeId);
    if (!sourceNode) return;
    // node.data is the Card object (set in cardToNode), clone via JSON for deep copy
    const cloned: Card = JSON.parse(JSON.stringify(sourceNode.data));
    cloned.id = `dup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    cloned.position = {
      x: sourceNode.position.x + DUPLICATE_OFFSET,
      y: sourceNode.position.y + DUPLICATE_OFFSET,
    };
    onAddCard(cloned);
  }, [contextMenu, externalNodes, onAddCard]);

  // Get locked state for context menu
  const contextMenuNode = contextMenu ? nodes.find((n) => n.id === contextMenu.nodeId) : null;
  const contextMenuMeta = contextMenuNode?.data?.metadata;
  const contextMenuIsLocked = contextMenuMeta !== null
    && contextMenuMeta !== undefined
    && typeof contextMenuMeta === 'object'
    && 'locked' in contextMenuMeta
    && contextMenuMeta.locked === true;

  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const edgeTypes = useMemo(() => EDGE_TYPES, []);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edgesWithCallbacks}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        onInit={handleInit}
        onNodesChange={onNodesChange}
        onEdgesChange={onLocalEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        fitView={externalNodes.length > 0}
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable
        nodesConnectable
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={24}
          color={alpha(theme.palette.text.primary, 0.04)}
        />

        {/* Empty state overlay */}
        {isEmpty && (
          <Panel position="top-center">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                userSelect: 'none',
                maxWidth: 240,
                textAlign: 'center',
                mt: '20%',
              }}
            >
              <Box
                sx={{
                  fontSize: 48,
                  lineHeight: 1,
                  animation: 'empty-float 3s ease-in-out infinite',
                  '@keyframes empty-float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                  },
                }}
              >
                {'🧠'}
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: alpha(theme.palette.text.primary, 0.3) }}>
                Nothing here yet
              </Typography>
              <Typography sx={{ fontSize: 12, color: alpha(theme.palette.text.primary, 0.2), lineHeight: 1.6 }}>
                Type something on the left and the AI will magically fill this space with charts, tables, and insights
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.5,
                  color: alpha(theme.palette.text.primary, 0.15),
                }}
              >
                <MousePointerClick size={12} />
                <Typography sx={{ fontSize: 10 }}>
                  cards will appear here
                </Typography>
              </Box>
            </Box>
          </Panel>
        )}

        {onAddCard && <CanvasToolbar onAddCard={onAddCard} />}

        {onToggleMaximize && (
          <Panel position="bottom-right">
            <Tooltip title={isMaximized ? 'Show chat panel' : 'Maximize canvas'}>
              <IconButton
                size="small"
                onClick={onToggleMaximize}
                sx={{
                  bgcolor: isMaximized ? 'primary.main' : alpha(theme.palette.text.primary, 0.08),
                  color: isMaximized ? 'primary.contrastText' : 'text.secondary',
                  '&:hover': {
                    bgcolor: isMaximized ? 'primary.dark' : alpha(theme.palette.text.primary, 0.12),
                  },
                  width: 32,
                  height: 32,
                }}
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </IconButton>
            </Tooltip>
          </Panel>
        )}
      </ReactFlow>

      <CanvasContextMenu
        anchorPosition={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        isLocked={contextMenuIsLocked}
        onClose={closeContextMenu}
        onDelete={handleContextDelete}
        onLockToggle={handleContextLockToggle}
        onDuplicate={handleDuplicate}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
      />
    </Box>
  );
}
