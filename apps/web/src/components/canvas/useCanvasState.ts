import { useCallback, useMemo, useState } from 'react';

import type { Edge, Node } from '@xyflow/react';

import type { NonDbId } from '@grabdy/common';
import type { CanvasEdge, CanvasState, Card } from '@grabdy/contracts';
import type { CanvasUpdate } from '@/lib/api';

/** Merge partial data into a component while preserving its discriminated union type. */
function mergeComponentData<T extends Card['component']>(component: T, data: Record<string, unknown>): T {
  return { ...component, data: { ...component.data, ...data } };
}

const EMPTY_CANVAS: CanvasState = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  cards: [],
  edges: [],
};

function cardToNode(card: Card): Node {
  return {
    id: card.id,
    type: 'card',
    position: card.position,
    data: card,
    style: { width: card.width },
    zIndex: card.zIndex,
  };
}

function canvasEdgeToReactFlowEdge(edge: CanvasEdge): Edge {
  return {
    id: edge.id,
    type: 'custom',
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: {
      strokeWidth: edge.strokeWidth ?? 2,
    },
  };
}

export function useCanvasState() {
  const [canvasState, setCanvasState] = useState<CanvasState>(EMPTY_CANVAS);

  // Derive ReactFlow nodes/edges from the single source of truth
  const nodes = useMemo(() => canvasState.cards.map(cardToNode), [canvasState.cards]);
  const edges = useMemo(() => (canvasState.edges ?? []).map(canvasEdgeToReactFlowEdge), [canvasState.edges]);

  const loadState = useCallback((state: CanvasState | null) => {
    setCanvasState(state ?? EMPTY_CANVAS);
  }, []);

  const applyUpdate = useCallback((update: CanvasUpdate) => {
    setCanvasState((prev) => {
      if (update.tool === 'canvas_add_card') {
        const cards = update.result.cards;
        if (cards && cards.length > 0) {
          return { ...prev, cards: [...prev.cards, ...cards] };
        }
        console.warn('[canvas] canvas_add_card: no cards in result', update.result);
        return prev;
      }
      if (update.tool === 'canvas_remove_card') {
        return { ...prev, cards: prev.cards.filter((c) => c.id !== update.args.cardId) };
      }
      if (update.tool === 'canvas_move_card') {
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === update.args.cardId
              ? {
                  ...c,
                  ...(update.args.position && { position: update.args.position }),
                  ...(update.args.width !== undefined && { width: update.args.width }),
                  ...(update.args.height !== undefined && { height: update.args.height }),
                }
              : c,
          ),
        };
      }
      if (update.tool === 'canvas_update_component') {
        return {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === update.args.cardId && c.component.id === update.args.componentId
              ? { ...c, component: mergeComponentData(c.component, update.args.data) }
              : c,
          ),
        };
      }
      if (update.tool === 'canvas_add_edge') {
        const { edge } = update.args;
        const exists = prev.edges.some(
          (e) =>
            (e.source === edge.source && e.target === edge.target) ||
            (e.source === edge.target && e.target === edge.source),
        );
        if (exists) return prev;
        return { ...prev, edges: [...prev.edges, edge] };
      }
      if (update.tool === 'canvas_remove_edge') {
        return { ...prev, edges: prev.edges.filter((e) => e.id !== update.args.edgeId) };
      }
      return prev;
    });
  }, []);

  const removeCard = useCallback((cardId: NonDbId<'CanvasCard'>) => {
    setCanvasState((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
      edges: prev.edges.filter((e) => e.source !== cardId && e.target !== cardId),
    }));
  }, []);

  const moveCard = useCallback((cardId: NonDbId<'CanvasCard'>, position: { x: number; y: number }) => {
    setCanvasState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, position } : c)),
    }));
  }, []);

  const updateEdges = useCallback((newEdges: CanvasEdge[]) => {
    setCanvasState((prev) => ({ ...prev, edges: newEdges }));
  }, []);

  const updateCardTitle = useCallback((cardId: NonDbId<'CanvasCard'>, title: string) => {
    setCanvasState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, title: title || undefined } : c)),
    }));
  }, []);

  const resizeCard = useCallback((cardId: NonDbId<'CanvasCard'>, width: number) => {
    setCanvasState((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, width } : c)),
    }));
  }, []);

  const reorderCard = useCallback((cardId: NonDbId<'CanvasCard'>, direction: 'front' | 'back'): number => {
    // newZIndex is assigned inside the updater and returned after — this works
    // because React processes functional updaters synchronously within the call.
    let newZIndex = 0;
    setCanvasState((prev) => {
      const card = prev.cards.find((c) => c.id === cardId);
      if (!card) return prev;
      const zValues = prev.cards.map((c) => c.zIndex ?? 0);
      newZIndex = direction === 'front' ? Math.max(...zValues) + 1 : Math.min(...zValues) - 1;
      return { ...prev, cards: prev.cards.map((c) => (c.id === cardId ? { ...c, zIndex: newZIndex } : c)) };
    });
    return newZIndex;
  }, []);

  const clearCanvas = useCallback(() => {
    setCanvasState(EMPTY_CANVAS);
  }, []);

  return {
    canvasState,
    nodes,
    edges,
    loadState,
    applyUpdate,
    removeCard,
    moveCard,
    resizeCard,
    reorderCard,
    updateCardTitle,
    updateEdges,
    clearCanvas,
  };
}
