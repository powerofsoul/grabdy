import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type NonDbId, nonDbIdSchema, packNonDbId } from '@grabdy/common';
import type { CanvasEdge, Card } from '@grabdy/contracts';
import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { ArrowsInIcon, ArrowsOutIcon, BrainIcon } from '@phosphor-icons/react';
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

import { useOptionalAuth } from '../../context/AuthContext';

import '@xyflow/react/dist/style.css';

const parseCardId = nonDbIdSchema('CanvasCard').parse;
const parseEdgeId = nonDbIdSchema('CanvasEdge').parse;

import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasToolbar } from './CanvasToolbar';
import { CardNode } from './CardNode';
import { renderComponent } from './componentRegistry';
import { CustomEdge } from './CustomEdge';

/**
 * Given two nodes, compute the best side (handle) for source and target
 * so the edge connects from the closest sides.
 */
function bestHandles(
  sourceNode: Node,
  targetNode: Node
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

interface CanvasPropsEditable {
  readOnly?: false;
  nodes: Node[];
  edges: Edge[];
  onDeleteCard: (cardId: NonDbId<'CanvasCard'>) => void;
  onMoveCard: (cardId: NonDbId<'CanvasCard'>, position: { x: number; y: number }) => void;
  onEdgesChange: (edges: CanvasEdge[]) => void;
  onAddEdge?: (edge: CanvasEdge) => void;
  onDeleteEdge?: (edgeId: NonDbId<'CanvasEdge'>) => void;
  onComponentEdit?: (
    cardId: NonDbId<'CanvasCard'>,
    componentId: NonDbId<'CanvasComponent'>,
    data: Record<string, unknown>
  ) => void;
  onTitleEdit?: (cardId: NonDbId<'CanvasCard'>, title: string) => void;
  onResizeCard?: (cardId: NonDbId<'CanvasCard'>, width: number) => void;
  onReorderCard?: (cardId: NonDbId<'CanvasCard'>, direction: 'front' | 'back') => void;
  onAddCard?: (card: Card) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

interface CanvasPropsReadOnly {
  readOnly: true;
  nodes: Node[];
  edges: Edge[];
}

type CanvasProps = CanvasPropsEditable | CanvasPropsReadOnly;

const NODE_TYPES = { card: CardNode };
const EDGE_TYPES = { custom: CustomEdge };
const DEFAULT_EDGE_OPTIONS = { type: 'custom' };
const FIT_VIEW_OPTIONS = { padding: 0.3, duration: 500 };

export function Canvas(props: CanvasProps) {
  const {
    nodes: externalNodes,
    edges: externalEdges,
    readOnly,
  } = props;

  const onDeleteCard = readOnly ? undefined : props.onDeleteCard;
  const onMoveCard = readOnly ? undefined : props.onMoveCard;
  const onEdgesChangeProp = readOnly ? undefined : props.onEdgesChange;
  const onAddEdge = readOnly ? undefined : props.onAddEdge;
  const onDeleteEdge = readOnly ? undefined : props.onDeleteEdge;
  const onComponentEdit = readOnly ? undefined : props.onComponentEdit;
  const onTitleEdit = readOnly ? undefined : props.onTitleEdit;
  const onResizeCard = readOnly ? undefined : props.onResizeCard;
  const onReorderCard = readOnly ? undefined : props.onReorderCard;
  const onAddCard = readOnly ? undefined : props.onAddCard;
  const isMaximized = readOnly ? undefined : props.isMaximized;
  const onToggleMaximize = readOnly ? undefined : props.onToggleMaximize;
  const theme = useTheme();
  const auth = useOptionalAuth();
  const selectedOrgId = auth?.selectedOrgId;
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const prevNodeCount = useRef(0);

  const isEmpty = externalNodes.length === 0;

  // Placement mode state
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [mouseScreenPos, setMouseScreenPos] = useState({ x: 0, y: 0 });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Inject callbacks into each node's data
  const nodesWithCallbacks = useMemo(
    (): Node[] =>
      externalNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDelete: onDeleteCard ? () => onDeleteCard(parseCardId(node.id)) : undefined,
          onComponentEdit,
          onTitleEdit,
          onResize: onResizeCard
            ? (cardId: string, width: number) => onResizeCard(parseCardId(cardId), width)
            : undefined,
        },
      })),
    [externalNodes, onDeleteCard, onComponentEdit, onTitleEdit, onResizeCard]
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
  const edgeDataChangeRef =
    useRef<(edgeId: NonDbId<'CanvasEdge'>, data: Record<string, unknown>) => void>();

  // Debounce edge saves to backend
  const edgeSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const edgesToCanvasEdges = useCallback((rfEdges: Edge[]): CanvasEdge[] => {
    return rfEdges.map((e) => ({
      id: parseEdgeId(e.id),
      source: parseCardId(e.source),
      target: parseCardId(e.target),
      label: typeof e.label === 'string' ? e.label : undefined,
      strokeWidth: typeof e.data?.strokeWidth === 'number' ? e.data.strokeWidth : 2,
    }));
  }, []);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Prevent self-connections and duplicate edges
      if (connection.source === connection.target) return;

      setLocalEdges((prev) => {
        // CheckIcon for existing edge between same nodes (either direction)
        const exists = prev.some(
          (e) =>
            (e.source === connection.source && e.target === connection.target) ||
            (e.source === connection.target && e.target === connection.source)
        );
        if (exists) return prev;

        // Store as card-to-card — no handle IDs (computed dynamically)
        if (!selectedOrgId) return prev;
        const edgeId = packNonDbId('CanvasEdge', selectedOrgId);
        const newEdge: Edge = {
          id: edgeId,
          type: 'custom',
          source: connection.source,
          target: connection.target,
          data: { strokeWidth: 2 },
        };
        const canvasEdge: CanvasEdge = {
          id: edgeId,
          source: parseCardId(newEdge.source),
          target: parseCardId(newEdge.target),
          strokeWidth: 2,
        };
        if (onAddEdge) {
          onAddEdge(canvasEdge);
        } else {
          const updated = [...prev, newEdge];
          clearTimeout(edgeSaveTimer.current);
          edgeSaveTimer.current = setTimeout(() => {
            onEdgesChangeProp?.(edgesToCanvasEdges(updated));
          }, 500);
        }
        return [...prev, newEdge];
      });
    },
    [onEdgesChangeProp, onAddEdge, setLocalEdges, edgesToCanvasEdges, selectedOrgId]
  );

  const onLocalEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      handleEdgesChange(changes);
      const removals = changes.filter((c) => c.type === 'remove');
      if (removals.length > 0) {
        if (onDeleteEdge) {
          for (const removal of removals) {
            onDeleteEdge(parseEdgeId(removal.id));
          }
        } else {
          clearTimeout(edgeSaveTimer.current);
          edgeSaveTimer.current = setTimeout(() => {
            setLocalEdges((current) => {
              onEdgesChangeProp?.(edgesToCanvasEdges(current));
              return current;
            });
          }, 500);
        }
      }
    },
    [handleEdgesChange, onEdgesChangeProp, onDeleteEdge, setLocalEdges, edgesToCanvasEdges]
  );

  // Called by CustomEdge when arrow/stroke properties change
  const handleEdgeDataChange = useCallback(
    (edgeId: NonDbId<'CanvasEdge'>, newData: Record<string, unknown>) => {
      setLocalEdges((prev) => {
        const updated = prev.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, ...newData } } : e
        );
        clearTimeout(edgeSaveTimer.current);
        edgeSaveTimer.current = setTimeout(() => {
          onEdgesChangeProp?.(edgesToCanvasEdges(updated));
        }, 500);
        return updated;
      });
    },
    [onEdgesChangeProp, setLocalEdges, edgesToCanvasEdges]
  );

  useEffect(() => {
    edgeDataChangeRef.current = handleEdgeDataChange;
  }, [handleEdgeDataChange]);

  // Compute best handles + inject callbacks into edge data
  const edgesWithCallbacks = useMemo((): Edge[] => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return localEdges.map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const handles =
        sourceNode && targetNode
          ? bestHandles(sourceNode, targetNode)
          : { sourceHandle: 'right', targetHandle: 'left' };
      return {
        ...edge,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        data: {
          ...edge.data,
          onEdgeDataChange: (newData: Record<string, unknown>) => {
            edgeDataChangeRef.current?.(parseEdgeId(edge.id), newData);
          },
        },
      };
    });
  }, [localEdges, nodes]);

  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      reactFlowRef.current = instance;
      if (externalNodes.length > 0) {
        instance.fitView(FIT_VIEW_OPTIONS);
      }
    },
    [externalNodes.length]
  );

  // Auto-fit when first nodes appear (0 → N transition)
  useEffect(() => {
    if (prevNodeCount.current === 0 && externalNodes.length > 0 && reactFlowRef.current) {
      // Small delay lets ReactFlow measure the new nodes before fitting
      setTimeout(() => {
        reactFlowRef.current?.fitView(FIT_VIEW_OPTIONS);
      }, 50);
    }
    prevNodeCount.current = externalNodes.length;
  }, [externalNodes.length]);

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      onMoveCard?.(parseCardId(node.id), node.position);
    },
    [onMoveCard]
  );

  // Right-click context menu on nodes
  const handleNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  // Prevent default context menu on canvas pane + cancel placement
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      if (pendingCard) {
        setPendingCard(null);
      }
    },
    [pendingCard]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu actions
  const handleContextDelete = useCallback(() => {
    if (contextMenu) onDeleteCard?.(parseCardId(contextMenu.nodeId));
  }, [contextMenu, onDeleteCard]);

  const handleBringToFront = useCallback(() => {
    if (contextMenu && onReorderCard) onReorderCard(parseCardId(contextMenu.nodeId), 'front');
  }, [contextMenu, onReorderCard]);

  const handleSendToBack = useCallback(() => {
    if (contextMenu && onReorderCard) onReorderCard(parseCardId(contextMenu.nodeId), 'back');
  }, [contextMenu, onReorderCard]);

  const handleDuplicate = useCallback(() => {
    if (!contextMenu || !onAddCard) return;
    const sourceNode = externalNodes.find((n) => n.id === contextMenu.nodeId);
    if (!sourceNode) return;
    const cloned: Card = JSON.parse(JSON.stringify(sourceNode.data));
    if (!selectedOrgId) return;
    cloned.id = packNonDbId('CanvasCard', selectedOrgId);
    cloned.position = { x: 0, y: 0 };
    setPendingCard(cloned);
  }, [contextMenu, externalNodes, onAddCard, selectedOrgId]);

  // --- Placement mode handlers ---

  const [ghostZoom, setGhostZoom] = useState(1);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!pendingCard) return;
      setMouseScreenPos({ x: event.clientX, y: event.clientY });
      if (reactFlowRef.current) {
        setGhostZoom(reactFlowRef.current.getZoom());
      }
    },
    [pendingCard]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!pendingCard || !onAddCard || !reactFlowRef.current) return;
      event.stopPropagation();
      const width = pendingCard.width ?? 400;
      const flowPos = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onAddCard({ ...pendingCard, position: { x: flowPos.x - width / 2, y: flowPos.y } });
      setPendingCard(null);
    },
    [pendingCard, onAddCard]
  );

  // Escape key cancels placement
  useEffect(() => {
    if (!pendingCard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingCard(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCard]);

  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const edgeTypes = useMemo(() => EDGE_TYPES, []);

  const isPlacing = pendingCard !== null;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: isPlacing ? 'crosshair' : undefined,
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.default, 0.6)
            : alpha(theme.palette.text.primary, 0.02),
      }}
      onMouseMove={handleMouseMove}
    >
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
        onNodeContextMenu={readOnly ? undefined : handleNodeContextMenu}
        onPaneContextMenu={readOnly ? undefined : handlePaneContextMenu}
        onPaneClick={readOnly ? undefined : handlePaneClick}
        fitView={externalNodes.length > 0}
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!readOnly && !isPlacing}
        nodesConnectable={!readOnly && !isPlacing}
        elementsSelectable={!readOnly && !isPlacing}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={alpha(theme.palette.text.primary, 0.08)}
        />

        {/* Empty state overlay — centered via absolute positioning so it stays mid-canvas in every layout */}
        {isEmpty && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                userSelect: 'none',
                maxWidth: 280,
                textAlign: 'center',
              }}
            >
              <BrainIcon size={48} weight="light" color={alpha(theme.palette.text.primary, 0.12)} />
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: alpha(theme.palette.text.primary, 0.22),
                  mt: 1,
                }}
              >
                Nothing here yet
              </Typography>
              {!readOnly && (
                <Typography
                  sx={{
                    fontSize: 13,
                    color: alpha(theme.palette.text.primary, 0.14),
                    lineHeight: 1.6,
                  }}
                >
                  Ask something in the chat and cards will appear here
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {!readOnly && onAddCard && <CanvasToolbar onStartPlacement={setPendingCard} />}

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
                {isMaximized ? (
                  <ArrowsInIcon size={16} weight="light" color="currentColor" />
                ) : (
                  <ArrowsOutIcon size={16} weight="light" color="currentColor" />
                )}
              </IconButton>
            </Tooltip>
          </Panel>
        )}
      </ReactFlow>

      {/* Ghost card overlay during placement mode */}
      {pendingCard && (
        <Box
          sx={{
            position: 'fixed',
            left: mouseScreenPos.x,
            top: mouseScreenPos.y,
            width: pendingCard.width ?? 400,
            opacity: 0.7,
            pointerEvents: 'none',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.3),
            borderRadius: 2,
            p: 1,
            boxShadow: `0 4px 20px ${alpha(theme.palette.text.primary, 0.15)}`,
            transform: `translate(-50%, 0) scale(${ghostZoom})`,
            transformOrigin: 'top center',
          }}
        >
          {renderComponent(pendingCard.component, parseCardId(pendingCard.id))}
        </Box>
      )}

      {!readOnly && (
        <CanvasContextMenu
          anchorPosition={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
          onClose={closeContextMenu}
          onDelete={handleContextDelete}
          onDuplicate={handleDuplicate}
          onBringToFront={onReorderCard ? handleBringToFront : undefined}
          onSendToBack={onReorderCard ? handleSendToBack : undefined}
        />
      )}
    </Box>
  );
}
