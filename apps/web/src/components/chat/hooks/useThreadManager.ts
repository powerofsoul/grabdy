import { useCallback, useEffect, useRef, useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';
import type { CanvasState } from '@grabdy/contracts';
import { toast } from 'sonner';

import type { ChatMessage } from '../types';
import { parseBlocks } from '../parse-blocks';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export interface Thread {
  id: DbId<'ChatThread'>;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseThreadManagerParams {
  initialThreadId?: string;
  onThreadChange?: (threadId: string | undefined) => void;
  onLoadMessages: (messages: ChatMessage[]) => void;
  onLoadCanvas: (canvasState: CanvasState | null) => void;
  onClearState: () => void;
}

export function useThreadManager({
  initialThreadId,
  onThreadChange,
  onLoadMessages,
  onLoadCanvas,
  onClearState,
}: UseThreadManagerParams) {
  const { selectedOrgId } = useAuth();

  const [threads, setThreads] = useState<Thread[]>([]);
  const parsedInitialThreadId = initialThreadId
    ? dbIdSchema('ChatThread').safeParse(initialThreadId)
    : undefined;

  const [activeThreadId, setActiveThreadId] = useState<DbId<'ChatThread'> | undefined>(
    parsedInitialThreadId?.success ? parsedInitialThreadId.data : undefined,
  );
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Keep activeThreadId in a ref so ensureThread can read the latest value
  // without needing it as a useCallback dependency (avoids stale closures).
  const activeThreadIdRef = useRef(activeThreadId);
  useEffect(() => { activeThreadIdRef.current = activeThreadId; }, [activeThreadId]);

  const fetchThreads = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.chat.listThreads({ params: { orgId: selectedOrgId } });
      if (res.status === 200) {
        setThreads(res.body.data);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingThreads(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Sync active thread ID to URL
  useEffect(() => {
    onThreadChange?.(activeThreadId);
  }, [activeThreadId, onThreadChange]);

  const loadThread = useCallback(
    async (threadId: DbId<'ChatThread'>) => {
      if (!selectedOrgId) return;
      setActiveThreadId(threadId);
      setIsLoadingMessages(true);
      try {
        const res = await api.chat.getThread({
          params: { orgId: selectedOrgId, threadId },
        });
        if (res.status === 200) {
          onLoadMessages(
            res.body.data.messages.map((m) => {
              if (m.role === 'user') {
                return {
                  id: m.id,
                  role: m.role,
                  content: m.content,
                };
              }
              // Assistant messages: parse blocks from raw content
              const blocks = parseBlocks(m.content);
              // Merge: API-level sources take priority, then parsed
              const apiSources = m.sources && m.sources.length > 0 ? m.sources : undefined;
              return {
                id: m.id,
                role: m.role,
                content: blocks.text,
                thinkingTexts: blocks.thinkingTexts.length > 0 ? blocks.thinkingTexts : undefined,
                sources: apiSources ?? (blocks.sources.length > 0 ? blocks.sources : undefined),
              };
            }),
          );
          onLoadCanvas(res.body.data.canvasState);
        }
      } catch {
        toast.error('Failed to load thread');
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [selectedOrgId, onLoadMessages, onLoadCanvas],
  );

  // Load initial thread from URL on mount, clear on org switch
  const initialLoadDone = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedOrgId || initialLoadDone.current === selectedOrgId) return;
    const isOrgSwitch = initialLoadDone.current !== null;
    initialLoadDone.current = selectedOrgId;

    if (isOrgSwitch) {
      onClearState();
      setActiveThreadId(undefined);
    } else if (parsedInitialThreadId?.success) {
      loadThread(parsedInitialThreadId.data);
    }
  }, [parsedInitialThreadId, loadThread, selectedOrgId, onClearState]);

  // Guard against concurrent ensureThread calls (e.g. double-click)
  const pendingCreateRef = useRef<Promise<DbId<'ChatThread'>> | null>(null);

  /** Returns the current thread ID, creating one first if needed. */
  const ensureThread = useCallback(async (): Promise<DbId<'ChatThread'>> => {
    const current = activeThreadIdRef.current;
    if (current) return current;

    // If a create is already in flight, piggyback on it
    if (pendingCreateRef.current) return pendingCreateRef.current;

    if (!selectedOrgId) throw new Error('No org selected');

    const promise = api.chat.createThread({
      params: { orgId: selectedOrgId },
      body: {},
    }).then((res) => {
      if (res.status === 200) {
        const id = res.body.data.id;
        setActiveThreadId(id);
        activeThreadIdRef.current = id;
        fetchThreads();
        return id;
      }
      throw new Error('Failed to create thread');
    }).finally(() => {
      pendingCreateRef.current = null;
    });

    pendingCreateRef.current = promise;
    return promise;
  }, [selectedOrgId, fetchThreads]);

  const handleNewThread = useCallback(() => {
    onClearState();
    setActiveThreadId(undefined);
  }, [onClearState]);

  const handleDeleteThread = async () => {
    if (!selectedOrgId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await api.chat.deleteThread({
        params: { orgId: selectedOrgId, threadId: deleteTarget.id },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Thread deleted');
        if (activeThreadId === deleteTarget.id) {
          handleNewThread();
        }
        fetchThreads();
      }
    } catch {
      toast.error('Failed to delete thread');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleRename = async (threadId: DbId<'ChatThread'>) => {
    if (!selectedOrgId || !renameValue.trim()) return;
    try {
      await api.chat.renameThread({
        params: { orgId: selectedOrgId, threadId },
        body: { title: renameValue.trim() },
      });
      fetchThreads();
    } catch {
      toast.error('Failed to rename thread');
    } finally {
      setRenamingThreadId(null);
      setRenameValue('');
    }
  };

  return {
    threads,
    activeThreadId,
    setActiveThreadId,
    isLoadingThreads,
    isLoadingMessages,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    renamingThreadId,
    setRenamingThreadId,
    renameValue,
    setRenameValue,
    fetchThreads,
    loadThread,
    ensureThread,
    handleNewThread,
    handleDeleteThread,
    handleRename,
  };
}
