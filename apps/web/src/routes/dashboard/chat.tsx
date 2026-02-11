import { useCallback, useEffect, useState } from 'react';

import {
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Edit3, MessageSquare, PanelLeftOpen, Plus, Trash2 } from 'lucide-react';
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

  return (
    <DashboardPage noPadding>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Thread toggle button */}
      <IconButton
        onClick={() => setThreadPanelOpen(true)}
        size="small"
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 1,
          color: 'text.secondary',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <PanelLeftOpen size={20} />
      </IconButton>

      {/* Thread Drawer */}
      <Drawer
        anchor="left"
        open={threadPanelOpen}
        onClose={() => setThreadPanelOpen(false)}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<Plus size={18} />}
            onClick={handleNewThread}
          >
            New Chat
          </Button>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {isLoadingThreads ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : threads.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No conversations yet
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {threads.map((thread) => (
                <ListItemButton
                  key={thread.id}
                  selected={thread.id === activeThreadId}
                  onClick={() => loadThread(thread.id)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&.Mui-selected': { bgcolor: 'action.selected' },
                  }}
                >
                  <MessageSquare size={16} style={{ flexShrink: 0, marginRight: 8, opacity: 0.5 }} />
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
                    <ListItemText
                      primary={thread.title ?? 'Untitled'}
                      primaryTypographyProps={{
                        noWrap: true,
                        fontSize: '0.85rem',
                      }}
                      secondary={new Date(thread.updatedAt).toLocaleDateString()}
                      secondaryTypographyProps={{ fontSize: '0.72rem' }}
                    />
                  )}
                  <Box sx={{ display: 'flex', gap: 0.25, ml: 0.5, flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingThreadId(thread.id);
                        setRenameValue(thread.title ?? '');
                      }}
                      sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                    >
                      <Edit3 size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(thread);
                      }}
                      sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Box>
                </ListItemButton>
              ))}
            </List>
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
            gap: 4,
          }}
        >
          <ChatEmptyState onPromptClick={handleSend} />
          <Box sx={{ width: '100%', maxWidth: 680, '& > *': { borderTop: 'none' } }}>
            <ChatInput onSend={handleSend} isStreaming={isStreaming} />
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
