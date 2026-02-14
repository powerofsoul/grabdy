import { useCallback, useEffect, useRef } from 'react';

import { type DbId, type NonDbId, packNonDbId } from '@grabdy/common';
import type { CanvasEdge, CanvasState, Card } from '@grabdy/contracts';
import { toast } from 'sonner';

import type { useCanvasState } from '@/components/canvas/useCanvasState';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

type CanvasActions = ReturnType<typeof useCanvasState>;

interface UseCanvasOpsParams {
  activeThreadId: DbId<'ChatThread'> | undefined;
  ensureThread: () => Promise<DbId<'ChatThread'>>;
  canvasActions: CanvasActions;
  isStreaming: boolean;
}

export function useCanvasOps({ activeThreadId, ensureThread, canvasActions, isStreaming }: UseCanvasOpsParams) {
  const { selectedOrgId } = useAuth();
  const { canvasState, loadState, applyUpdate, removeCard, moveCard, resizeCard, reorderCard, updateCardTitle, updateEdges } = canvasActions;

  // Track streaming state in a ref so syncFromResponse doesn't cascade useCallback invalidations
  const isStreamingRef = useRef(false);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  const syncFromResponse = useCallback(
    (state: CanvasState) => {
      if (!isStreamingRef.current) loadState(state);
    },
    [loadState],
  );

  const handleDeleteCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>) => {
      removeCard(cardId);
      if (selectedOrgId && activeThreadId) {
        api.retrieval.deleteCanvasCard({
          params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
          body: {},
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }).catch(() => { toast.error('Failed to save changes'); });
      }
    },
    [removeCard, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleMoveCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, position: { x: number; y: number }) => {
      moveCard(cardId, position);
      if (!selectedOrgId || !activeThreadId) return;
      api.retrieval.moveCanvasCard({
        params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
        body: { position },
      }).then((res) => {
        if (res.status === 200) syncFromResponse(res.body.canvasState);
      }).catch(() => { toast.error('Failed to save changes'); });
    },
    [moveCard, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleResizeCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, width: number) => {
      resizeCard(cardId, width);
      if (!selectedOrgId || !activeThreadId) return;
      api.retrieval.moveCanvasCard({
        params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
        body: { width },
      }).then((res) => {
        if (res.status === 200) syncFromResponse(res.body.canvasState);
      }).catch(() => { toast.error('Failed to save changes'); });
    },
    [resizeCard, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleReorderCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, direction: 'front' | 'back') => {
      const zIndex = reorderCard(cardId, direction);
      if (!selectedOrgId || !activeThreadId) return;
      api.retrieval.moveCanvasCard({
        params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
        body: { zIndex },
      }).then((res) => {
        if (res.status === 200) syncFromResponse(res.body.canvasState);
      }).catch(() => { toast.error('Failed to save changes'); });
    },
    [reorderCard, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleEdgesChange = useCallback(
    (newEdges: CanvasEdge[]) => {
      updateEdges(newEdges);
      if (selectedOrgId && activeThreadId) {
        api.retrieval.updateCanvasEdges({
          params: { orgId: selectedOrgId, threadId: activeThreadId },
          body: { edges: newEdges },
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }).catch(() => { toast.error('Failed to save changes'); });
      }
    },
    [updateEdges, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleAddEdge = useCallback(
    (edge: CanvasEdge) => {
      updateEdges([...(canvasState.edges ?? []), edge]);
      if (selectedOrgId && activeThreadId) {
        api.retrieval.addCanvasEdge({
          params: { orgId: selectedOrgId, threadId: activeThreadId },
          body: { edge },
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }).catch(() => { toast.error('Failed to save changes'); });
      }
    },
    [canvasState.edges, updateEdges, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: NonDbId<'CanvasEdge'>) => {
      updateEdges((canvasState.edges ?? []).filter((e) => e.id !== edgeId));
      if (selectedOrgId && activeThreadId) {
        api.retrieval.deleteCanvasEdge({
          params: { orgId: selectedOrgId, threadId: activeThreadId, edgeId },
          body: {},
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }).catch(() => { toast.error('Failed to save changes'); });
      }
    },
    [canvasState.edges, updateEdges, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleComponentEdit = useCallback(
    (cardId: NonDbId<'CanvasCard'>, componentId: NonDbId<'CanvasComponent'>, data: Record<string, unknown>) => {
      applyUpdate({
        tool: 'canvas_update_component',
        args: { cardId, componentId, data },
        result: { cardId, componentId },
      });
      if (selectedOrgId && activeThreadId) {
        api.retrieval.updateCanvasComponent({
          params: { orgId: selectedOrgId, threadId: activeThreadId, cardId, componentId },
          body: { data },
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }).catch(() => { toast.error('Failed to save changes'); });
      }
    },
    [applyUpdate, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleTitleEdit = useCallback(
    (cardId: NonDbId<'CanvasCard'>, title: string) => {
      updateCardTitle(cardId, title);
      if (selectedOrgId && activeThreadId) {
        api.retrieval.moveCanvasCard({
          params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
          body: { title },
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }).catch(() => { toast.error('Failed to save changes'); });
      }
    },
    [updateCardTitle, selectedOrgId, activeThreadId, syncFromResponse],
  );

  const handleAddCard = useCallback(
    (card: Card) => {
      if (!selectedOrgId) return;
      const properCard = { ...card, id: packNonDbId('CanvasCard', selectedOrgId) };
      applyUpdate({
        tool: 'canvas_add_card',
        args: { cards: [properCard] },
        result: { cards: [properCard] },
      });
      ensureThread().then((threadId) =>
        api.retrieval.addCanvasCard({
          params: { orgId: selectedOrgId, threadId },
          body: { card: properCard },
        }).then((res) => {
          if (res.status === 200) syncFromResponse(res.body.canvasState);
        }),
      ).catch(() => { toast.error('Failed to save changes'); });
    },
    [applyUpdate, selectedOrgId, ensureThread, syncFromResponse],
  );

  return {
    handleDeleteCard,
    handleMoveCard,
    handleResizeCard,
    handleReorderCard,
    handleEdgesChange,
    handleAddEdge,
    handleDeleteEdge,
    handleComponentEdit,
    handleTitleEdit,
    handleAddCard,
  };
}
