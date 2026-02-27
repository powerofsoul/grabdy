import { type ReactNode, useCallback, useState } from 'react';

import type { DbId } from '@grabdy/common';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ChatCircleIcon,
  ClockCounterClockwiseIcon,
  ListIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';

import { ChatEmptyState } from './components/ChatEmptyState';
import { ChatInput } from './components/ChatInput';
import { ChatMessages } from './components/ChatMessages';
import { ShareButton } from './components/share';
import { useChatStream } from './hooks/useChatStream';
import { useThreadManager } from './hooks/useThreadManager';
import type { ChatMessage } from './types';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useMobileSidebar } from '@/components/ui/Sidebar';

interface ChatPanelProps {
  headerSlot?: ReactNode;
  tabsSlot?: ReactNode;
  trailingSlot?: ReactNode;
  headerHeight?: number;
  initialThreadId?: string;
  botId?: DbId<'Bot'>;
  onThreadChange?: (threadId: string | undefined) => void;
  showMobileSidebar?: boolean;
  botTitle?: string;
  botSubtitle?: string;
  botPlaceholder?: string;
  botImageUrl?: string;
  botAccentColor?: string;
  botPrimaryColor?: string;
}

export function ChatPanel({
  headerSlot,
  tabsSlot,
  trailingSlot,
  headerHeight = 48,
  initialThreadId,
  botId,
  onThreadChange,
  showMobileSidebar = true,
  botTitle,
  botSubtitle,
  botPlaceholder,
  botImageUrl,
  botAccentColor,
  botPrimaryColor,
}: ChatPanelProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isMobile = useMediaQuery('(max-width:767px)');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadPanelOpen, setThreadPanelOpen] = useState(false);

  const threadManager = useThreadManager({
    initialThreadId,
    botId,
    onThreadChange,
    onLoadMessages: setMessages,
    onClearState: useCallback(() => {
      setMessages([]);
      setThreadPanelOpen(false);
    }, []),
  });

  const chatStream = useChatStream({
    ensureThread: threadManager.ensureThread,
    setActiveThreadId: threadManager.setActiveThreadId,
    setMessages,
    fetchThreads: threadManager.fetchThreads,
    botId,
  });

  const isEmpty = messages.length === 0 && !chatStream.isStreaming;
  const activeThread = threadManager.threads.find((t) => t.id === threadManager.activeThreadId);

  const chatContent =
    isEmpty && !threadManager.isLoadingMessages ? (
      <Stack
        sx={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          gap: 1.5,
          pb: 8,
        }}
      >
        <ChatEmptyState
          title={botTitle}
          subtitle={botSubtitle}
          imageUrl={botImageUrl}
          primaryColor={botPrimaryColor}
        />
        <Box sx={{ width: '100%', maxWidth: 680 }}>
          <ChatInput
            onSend={chatStream.handleSend}
            isStreaming={chatStream.isStreaming}
            elevated
            placeholder={botPlaceholder}
            accentColor={botAccentColor}
          />
        </Box>
      </Stack>
    ) : (
      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <ChatMessages
          messages={messages}
          isLoading={threadManager.isLoadingMessages}
          isStreaming={chatStream.isStreaming}
          accentColor={botAccentColor}
        />
        <ChatInput
          onSend={chatStream.handleSend}
          isStreaming={chatStream.isStreaming}
          placeholder={botPlaceholder}
          accentColor={botAccentColor}
        />
      </Stack>
    );

  const threadDrawer = (
    <Drawer
      anchor="right"
      open={threadPanelOpen}
      onClose={() => setThreadPanelOpen(false)}
      variant="temporary"
      sx={{
        '& .MuiDrawer-paper': {
          width: isMobile ? '85vw' : 320,
          maxWidth: 320,
          boxSizing: 'border-box',
          bgcolor: 'background.default',
          borderLeft: '1px solid',
          borderColor: alpha(ct, 0.08),
        },
      }}
    >
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
        <Typography variant="subtitle1">Conversations</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="New chat">
            <IconButton
              size="small"
              onClick={threadManager.handleNewThread}
              sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
            >
              <PlusIcon size={16} weight="light" color="currentColor" />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={() => setThreadPanelOpen(false)}
            sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
          >
            <XIcon size={16} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {threadManager.isLoadingThreads ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={20} />
          </Box>
        ) : threadManager.threads.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: alpha(ct, 0.4) }}>
              No conversations yet
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, px: 1 }}>
            {threadManager.threads.map((thread) => (
              <Box
                key={thread.id}
                onClick={() => {
                  threadManager.loadThread(thread.id);
                  setThreadPanelOpen(false);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor:
                    thread.id === threadManager.activeThreadId ? alpha(ct, 0.06) : 'transparent',
                  transition: 'background-color 120ms ease',
                  '&:hover': {
                    bgcolor: alpha(ct, thread.id === threadManager.activeThreadId ? 0.08 : 0.04),
                    '& .thread-actions': { opacity: 1 },
                  },
                }}
              >
                <ChatCircleIcon
                  size={15}
                  weight="light"
                  color="currentColor"
                  style={{ flexShrink: 0, opacity: 0.35 }}
                />
                {threadManager.renamingThreadId === thread.id ? (
                  <TextField
                    size="small"
                    value={threadManager.renameValue}
                    onChange={(e) => threadManager.setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') threadManager.handleRename(thread.id);
                      if (e.key === 'Escape') threadManager.setRenamingThreadId(null);
                    }}
                    onBlur={() => threadManager.handleRename(thread.id)}
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
                        fontWeight: thread.id === threadManager.activeThreadId ? 600 : 400,
                        color:
                          thread.id === threadManager.activeThreadId
                            ? 'text.primary'
                            : 'text.secondary',
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
                  sx={{
                    display: 'flex',
                    gap: 0,
                    flexShrink: 0,
                    opacity: 0,
                    transition: 'opacity 120ms ease',
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      threadManager.setRenamingThreadId(thread.id);
                      threadManager.setRenameValue(thread.title ?? '');
                    }}
                    sx={{ color: alpha(ct, 0.35), p: 0.5, '&:hover': { color: 'text.primary' } }}
                  >
                    <PencilSimpleIcon size={13} weight="light" color="currentColor" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      threadManager.setDeleteTarget(thread);
                    }}
                    sx={{ color: alpha(ct, 0.35), p: 0.5, '&:hover': { color: 'error.main' } }}
                  >
                    <TrashIcon size={13} weight="light" color="currentColor" />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Drawer>
  );

  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      {isMobile ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            height: 44,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
            gap: 0.5,
          }}
        >
          <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, pl: 1 }}>Chat</Typography>
          {showMobileSidebar && (
            <IconButton size="small" onClick={toggleMobileSidebar} sx={{ color: 'text.primary' }}>
              <ListIcon size={20} weight="regular" />
            </IconButton>
          )}
        </Box>
      ) : (
        (headerSlot || activeThread || trailingSlot) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              height: headerHeight,
              flexShrink: 0,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              {!activeThread && headerSlot}
              {activeThread && (
                <>
                  {headerSlot && (
                    <Box
                      sx={{ width: '1px', height: 20, bgcolor: alpha(ct, 0.1), flexShrink: 0 }}
                    />
                  )}
                  <Typography
                    sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}
                    noWrap
                  >
                    {activeThread.title ?? 'Untitled'}
                  </Typography>
                </>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {threadManager.activeThreadId && (
                <ShareButton threadId={threadManager.activeThreadId} />
              )}
              {trailingSlot}
            </Box>
          </Box>
        )
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.08),
          flexShrink: 0,
          px: isMobile ? 1.5 : 0,
          py: isMobile ? 0.75 : 0,
          gap: isMobile ? 1 : 0,
        }}
      >
        {tabsSlot && (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              '& > *': { borderBottom: 'none !important', width: '100%' },
            }}
          >
            {tabsSlot}
          </Box>
        )}
        {!tabsSlot && <Box sx={{ flex: 1 }} />}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            pr: isMobile ? 0 : 2,
            flexShrink: 0,
          }}
        >
          <Box
            onClick={threadManager.handleNewThread}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              cursor: 'pointer',
              color: alpha(ct, 0.5),
              transition: 'all 120ms ease',
              '&:hover': { color: 'text.primary', bgcolor: alpha(ct, 0.04) },
            }}
          >
            <PlusIcon size={18} weight="light" color="currentColor" />
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>New</Typography>
          </Box>
          <Box
            onClick={() => setThreadPanelOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              cursor: 'pointer',
              color: alpha(ct, 0.5),
              transition: 'all 120ms ease',
              '&:hover': { color: 'text.primary', bgcolor: alpha(ct, 0.04) },
            }}
          >
            <ClockCounterClockwiseIcon size={18} weight="light" color="currentColor" />
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>History</Typography>
          </Box>
        </Box>
      </Box>

      {threadDrawer}

      {/* Main content */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {chatContent}
      </Box>

      <ConfirmDialog
        open={!!threadManager.deleteTarget}
        title="Delete Thread"
        message={`Are you sure you want to delete "${threadManager.deleteTarget?.title ?? 'this conversation'}"? All messages will be lost.`}
        confirmLabel="Delete"
        onConfirm={threadManager.handleDeleteThread}
        onCancel={() => threadManager.setDeleteTarget(null)}
        isLoading={threadManager.isDeleting}
      />
    </Box>
  );
}
