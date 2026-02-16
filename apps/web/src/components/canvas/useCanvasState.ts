import { useCallback, useMemo, useState } from 'react';

import type { NonDbId } from '@grabdy/common';
import type { CanvasEdge, CanvasState } from '@grabdy/contracts';

import {
  canvasEdgeToReactFlowEdge,
  cardToNode,
  EMPTY_CANVAS,
  mergeComponentData,
} from './canvas-helpers';

import type { CanvasOpResult, CanvasUpdate } from '@/lib/api';

function applyOp(state: CanvasState, entry: CanvasOpResult): CanvasState {
  switch (entry.op) {
    case 'add_card': {
      if (entry.cards.length === 0) return state;
      return { ...state, cards: [...state.cards, ...entry.cards] };
    }
    case 'remove_card':
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== entry.cardId),
        edges: state.edges.filter((e) => e.source !== entry.cardId && e.target !== entry.cardId),
      };
    case 'move_card':
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === entry.cardId
            ? {
                ...c,
                ...(entry.position && { position: entry.position }),
                ...(entry.width !== undefined && { width: entry.width }),
                ...(entry.height !== undefined && { height: entry.height }),
              }
            : c
        ),
      };
    case 'update_component':
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === entry.cardId && c.component.id === entry.componentId
            ? { ...c, component: mergeComponentData(c.component, entry.data) }
            : c
        ),
      };
    case 'add_edge': {
      const exists = state.edges.some(
        (e) =>
          (e.source === entry.edge.source && e.target === entry.edge.target) ||
          (e.source === entry.edge.target && e.target === entry.edge.source)
      );
      if (exists) return state;
      return { ...state, edges: [...state.edges, entry.edge] };
    }
    case 'remove_edge':
      return { ...state, edges: state.edges.filter((e) => e.id !== entry.edgeId) };
  }
}

export function useCanvasState() {
  const [canvasState, setCanvasState] = useState<CanvasState>(EMPTY_CANVAS);

  // Derive ReactFlow nodes/edges from the single source of truth
  const nodes = useMemo(() => canvasState.cards.map(cardToNode), [canvasState.cards]);
  const edges = useMemo(
    () => (canvasState.edges ?? []).map(canvasEdgeToReactFlowEdge),
    [canvasState.edges]
  );

  const loadState = useCallback((state: CanvasState | null) => {
    setCanvasState(state ?? EMPTY_CANVAS);
  }, []);

  const applyUpdate = useCallback((update: CanvasUpdate) => {
    setCanvasState((prev) => {
      let state = prev;
      for (const entry of update.results) {
        state = applyOp(state, entry);
      }
      return state;
    });
  }, []);

  const removeCard = useCallback((cardId: NonDbId<'CanvasCard'>) => {
    setCanvasState((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
      edges: prev.edges.filter((e) => e.source !== cardId && e.target !== cardId),
    }));
  }, []);

  const moveCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, position: { x: number; y: number }) => {
      setCanvasState((prev) => ({
        ...prev,
        cards: prev.cards.map((c) => (c.id === cardId ? { ...c, position } : c)),
      }));
    },
    []
  );

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

  const reorderCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, direction: 'front' | 'back'): number => {
      // newZIndex is assigned inside the updater and returned after — this works
      // because React processes functional updaters synchronously within the call.
      let newZIndex = 0;
      setCanvasState((prev) => {
        const card = prev.cards.find((c) => c.id === cardId);
        if (!card) return prev;
        const zValues = prev.cards.map((c) => c.zIndex ?? 0);
        newZIndex = direction === 'front' ? Math.max(...zValues) + 1 : Math.min(...zValues) - 1;
        return {
          ...prev,
          cards: prev.cards.map((c) => (c.id === cardId ? { ...c, zIndex: newZIndex } : c)),
        };
      });
      return newZIndex;
    },
    []
  );

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
