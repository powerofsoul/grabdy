import { useCallback, useEffect, useState } from 'react';

import {
  alpha,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Edit3, History, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { ChatEmptyState, ChatInput, ChatMessage, ChatMessages } from '@/components/chat';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api, streamChat } from '@/lib/api';

import type { DbId } from '@grabdy/common';

interface Thread {
  id: DbId<'ChatThread'>;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export const Route = createFileRoute('/dashboard/chat')({
  component: ChatPage,
});

function ChatPage() {
  const { selectedOrgId } = useAuth();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<DbId<'ChatThread'> | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [threadPanelOpen, setThreadPanelOpen] = useState(false);

  const fetchThreads = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.retrieval.listThreads({ params: { orgId: selectedOrgId } });
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

  const loadThread = useCallback(async (threadId: DbId<'ChatThread'>) => {
    if (!selectedOrgId) return;
    setActiveThreadId(threadId);
    setIsLoadingMessages(true);
    setThreadPanelOpen(false);
    try {
      const res = await api.retrieval.getThread({
        params: { orgId: selectedOrgId, threadId },
      });
      if (res.status === 200) {
        setMessages(
          res.body.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources?.map((s) => ({
              content: s.content,
              score: s.score,
              dataSourceName: s.dataSourceName,
            })),
          }))
        );
      }
    } catch {
      toast.error('Failed to load thread');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedOrgId]);

  const handleNewThread = () => {
    setActiveThreadId(undefined);
    setMessages([]);
    setThreadPanelOpen(false);
  };

  const handleSend = useCallback(async (userMessage: string) => {
    if (!selectedOrgId || isStreaming) return;

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    setIsStreaming(true);

    try {
      let receivedFirstChunk = false;

      await streamChat(
        selectedOrgId,
        {
          message: userMessage,
          threadId: activeThreadId,
        },
        {
          onText: (text) => {
            if (!receivedFirstChunk) {
              receivedFirstChunk = true;
              setIsThinking(false);
              setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
            } else {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + text,
                  };
                }
                return updated;
              });
            }
          },
          onDone: (metadata) => {
            if (metadata.threadId) {
              setActiveThreadId(metadata.threadId as DbId<'ChatThread'>);
            }
            if (metadata.sources) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    sources: metadata.sources?.map((s) => ({
                      content: s.content,
                      score: s.score,
                      dataSourceName: s.dataSourceName,
                    })),
                  };
                }
                return updated;
              });
            }
            fetchThreads();
          },
          onError: (error) => {
            toast.error(error.message);
            if (!receivedFirstChunk) {
              setMessages((prev) => prev.slice(0, -1));
            }
          },
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
    }
  }, [selectedOrgId, activeThreadId, isStreaming, fetchThreads]);

  const handleDeleteThread = async () => {
    if (!selectedOrgId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await api.retrieval.deleteThread({
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

  const handleRename = async (threadId: string) => {
    if (!selectedOrgId || !renameValue.trim()) return;
    try {
      await api.retrieval.renameThread({
        params: { orgId: selectedOrgId, threadId: threadId as DbId<'ChatThread'> },
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

  const isEmpty = messages.length === 0 && !isThinking;

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <DashboardPage noPadding>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          height: 48,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.06),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {activeThread && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }} noWrap>
              {activeThread.title ?? 'Untitled'}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="New chat">
            <IconButton
              size="small"
              onClick={handleNewThread}
              sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
            >
              <Plus size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="History">
            <IconButton
              size="small"
              onClick={() => setThreadPanelOpen(true)}
              sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
            >
              <History size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Thread Drawer — RIGHT side */}
      <Drawer
        anchor="right"
        open={threadPanelOpen}
        onClose={() => setThreadPanelOpen(false)}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            bgcolor: 'background.default',
            borderLeft: '1px solid',
            borderColor: alpha(ct, 0.08),
            boxShadow: `0 0 40px ${alpha(ct, 0.08)}`,
          },
        }}
      >
        {/* Drawer header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            height: 56,
            borderBottom: '1px solid',
            borderColor: alpha(ct, 0.08),
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
            Conversations
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="New chat">
              <IconButton
                size="small"
                onClick={handleNewThread}
                sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
              >
                <Plus size={16} />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => setThreadPanelOpen(false)}
              sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
            >
              <X size={16} />
            </IconButton>
          </Box>
        </Box>

        {/* Thread list */}
        <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
          {isLoadingThreads ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={20} />
            </Box>
          ) : threads.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: alpha(ct, 0.4) }}>
                No conversations yet
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, px: 1 }}>
              {threads.map((thread) => (
                <Box
                  key={thread.id}
                  onClick={() => loadThread(thread.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    bgcolor: thread.id === activeThreadId ? alpha(ct, 0.06) : 'transparent',
                    transition: 'background-color 120ms ease',
                    '&:hover': {
                      bgcolor: alpha(ct, thread.id === activeThreadId ? 0.08 : 0.04),
                      '& .thread-actions': { opacity: 1 },
                    },
                  }}
                >
                  <MessageSquare size={15} style={{ flexShrink: 0, opacity: 0.35 }} />
                  {renamingThreadId === thread.id ? (
                    <TextField
                      size="small"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(thread.id);
                        if (e.key === 'Escape') setRenamingThreadId(null);
                      }}
                      onBlur={() => handleRename(thread.id)}
                      autoFocus
                      sx={{ flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        noWrap
                        sx={{
                          fontSize: 13,
                          fontWeight: thread.id === activeThreadId ? 600 : 400,
                          color: thread.id === activeThreadId ? 'text.primary' : 'text.secondary',
                        }}
                      >
                        {thread.title ?? 'Untitled'}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: alpha(ct, 0.3) }}>
                        {new Date(thread.updatedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                  <Box
                    className="thread-actions"
                    sx={{ display: 'flex', gap: 0, flexShrink: 0, opacity: 0, transition: 'opacity 120ms ease' }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingThreadId(thread.id);
                        setRenameValue(thread.title ?? '');
                      }}
                      sx={{ color: alpha(ct, 0.35), p: 0.5, '&:hover': { color: 'text.primary' } }}
                    >
                      <Edit3 size={13} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(thread);
                      }}
                      sx={{ color: alpha(ct, 0.35), p: 0.5, '&:hover': { color: 'error.main' } }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Chat Area */}
      {isEmpty && !isLoadingMessages ? (
        <Stack
          sx={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            gap: 3,
            pb: 8,
          }}
        >
          <ChatEmptyState onPromptClick={handleSend} />
          <Box sx={{ width: '100%', maxWidth: 680 }}>
            <ChatInput onSend={handleSend} isStreaming={isStreaming} elevated />
          </Box>
        </Stack>
      ) : (
        <Stack sx={{ flex: 1, minHeight: 0 }}>
          <ChatMessages
            messages={messages}
            isLoading={isLoadingMessages}
            isThinking={isThinking}
          />
          <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        </Stack>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Thread"
        message={`Are you sure you want to delete "${deleteTarget?.title ?? 'this conversation'}"? All messages will be lost.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteThread}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
      />
    </Box>
    </DashboardPage>
  );
}
