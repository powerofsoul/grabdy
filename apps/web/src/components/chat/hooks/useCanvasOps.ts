import { useCallback } from 'react';

import { type DbId, type NonDbId, packNonDbId } from '@grabdy/common';
import type { CanvasEdge, Card } from '@grabdy/contracts';
import { toast } from 'sonner';

import type { useCanvasState } from '@/components/canvas/useCanvasState';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

type CanvasActions = ReturnType<typeof useCanvasState>;

interface UseCanvasOpsParams {
  activeThreadId: DbId<'ChatThread'> | undefined;
  ensureThread: () => Promise<DbId<'ChatThread'>>;
  canvasActions: CanvasActions;
}

export function useCanvasOps({ activeThreadId, ensureThread, canvasActions }: UseCanvasOpsParams) {
  const { selectedOrgId } = useAuth();
  const {
    canvasState,
    applyUpdate,
    removeCard,
    moveCard,
    resizeCard,
    reorderCard,
    updateCardTitle,
    updateEdges,
  } = canvasActions;

  const handleDeleteCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>) => {
      removeCard(cardId);
      if (selectedOrgId && activeThreadId) {
        api.chat
          .deleteCanvasCard({
            params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
            body: {},
          })
          .catch(() => {
            toast.error('Failed to save changes');
          });
      }
    },
    [removeCard, selectedOrgId, activeThreadId]
  );

  const handleMoveCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, position: { x: number; y: number }) => {
      moveCard(cardId, position);
      if (!selectedOrgId || !activeThreadId) return;
      api.chat
        .moveCanvasCard({
          params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
          body: { position },
        })
        .catch(() => {
          toast.error('Failed to save changes');
        });
    },
    [moveCard, selectedOrgId, activeThreadId]
  );

  const handleResizeCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, width: number) => {
      resizeCard(cardId, width);
      if (!selectedOrgId || !activeThreadId) return;
      api.chat
        .moveCanvasCard({
          params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
          body: { width },
        })
        .catch(() => {
          toast.error('Failed to save changes');
        });
    },
    [resizeCard, selectedOrgId, activeThreadId]
  );

  const handleReorderCard = useCallback(
    (cardId: NonDbId<'CanvasCard'>, direction: 'front' | 'back') => {
      const zIndex = reorderCard(cardId, direction);
      if (!selectedOrgId || !activeThreadId) return;
      api.chat
        .moveCanvasCard({
          params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
          body: { zIndex },
        })
        .catch(() => {
          toast.error('Failed to save changes');
        });
    },
    [reorderCard, selectedOrgId, activeThreadId]
  );

  const handleEdgesChange = useCallback(
    (newEdges: CanvasEdge[]) => {
      updateEdges(newEdges);
      if (selectedOrgId && activeThreadId) {
        api.chat
          .updateCanvasEdges({
            params: { orgId: selectedOrgId, threadId: activeThreadId },
            body: { edges: newEdges },
          })
          .catch(() => {
            toast.error('Failed to save changes');
          });
      }
    },
    [updateEdges, selectedOrgId, activeThreadId]
  );

  const handleAddEdge = useCallback(
    (edge: CanvasEdge) => {
      updateEdges([...(canvasState.edges ?? []), edge]);
      if (selectedOrgId && activeThreadId) {
        api.chat
          .addCanvasEdge({
            params: { orgId: selectedOrgId, threadId: activeThreadId },
            body: { edge },
          })
          .catch(() => {
            toast.error('Failed to save changes');
          });
      }
    },
    [canvasState.edges, updateEdges, selectedOrgId, activeThreadId]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: NonDbId<'CanvasEdge'>) => {
      updateEdges((canvasState.edges ?? []).filter((e) => e.id !== edgeId));
      if (selectedOrgId && activeThreadId) {
        api.chat
          .deleteCanvasEdge({
            params: { orgId: selectedOrgId, threadId: activeThreadId, edgeId },
            body: {},
          })
          .catch(() => {
            toast.error('Failed to save changes');
          });
      }
    },
    [canvasState.edges, updateEdges, selectedOrgId, activeThreadId]
  );

  const handleComponentEdit = useCallback(
    (
      cardId: NonDbId<'CanvasCard'>,
      componentId: NonDbId<'CanvasComponent'>,
      data: Record<string, unknown>
    ) => {
      applyUpdate({
        results: [{ op: 'update_component', cardId, componentId, data }],
      });
      if (selectedOrgId && activeThreadId) {
        api.chat
          .updateCanvasComponent({
            params: { orgId: selectedOrgId, threadId: activeThreadId, cardId, componentId },
            body: { data },
          })
          .catch(() => {
            toast.error('Failed to save changes');
          });
      }
    },
    [applyUpdate, selectedOrgId, activeThreadId]
  );

  const handleTitleEdit = useCallback(
    (cardId: NonDbId<'CanvasCard'>, title: string) => {
      updateCardTitle(cardId, title);
      if (selectedOrgId && activeThreadId) {
        api.chat
          .moveCanvasCard({
            params: { orgId: selectedOrgId, threadId: activeThreadId, cardId },
            body: { title },
          })
          .catch(() => {
            toast.error('Failed to save changes');
          });
      }
    },
    [updateCardTitle, selectedOrgId, activeThreadId]
  );

  const handleAddCard = useCallback(
    (card: Card) => {
      if (!selectedOrgId) return;
      const properCard = { ...card, id: packNonDbId('CanvasCard', selectedOrgId) };
      applyUpdate({
        results: [{ op: 'add_card', cards: [properCard] }],
      });
      ensureThread()
        .then((threadId) =>
          api.chat.addCanvasCard({
            params: { orgId: selectedOrgId, threadId },
            body: { card: properCard },
          })
        )
        .catch(() => {
          toast.error('Failed to save changes');
        });
    },
    [applyUpdate, selectedOrgId, ensureThread]
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
