import { type ReactNode, useCallback, useState } from 'react';

import {
  alpha,
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
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
  SidebarSimpleIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';

import { ChatEmptyState } from './components/ChatEmptyState';
import { ChatInput } from './components/ChatInput';
import { ChatMessages } from './components/ChatMessages';
import { ShareButton } from './components/share';
import { useCanvasOps } from './hooks/useCanvasOps';
import { useChatStream } from './hooks/useChatStream';
import { useThreadManager } from './hooks/useThreadManager';
import type { ChatMessage } from './types';

import { Canvas, useCanvasState } from '@/components/canvas';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ResizablePanel } from '@/components/ui/ResizablePanel';
import { useMobileSidebar } from '@/components/ui/Sidebar';
import { STORAGE_KEYS } from '@/lib/storage-keys';

interface ChatPanelProps {
  headerSlot?: ReactNode;
  trailingSlot?: ReactNode;
  headerHeight?: number;
  initialThreadId?: string;
  onThreadChange?: (threadId: string | undefined) => void;
}

export function ChatPanel({
  headerSlot,
  trailingSlot,
  headerHeight = 48,
  initialThreadId,
  onThreadChange,
}: ChatPanelProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isMobile = useMediaQuery('(max-width:767px)');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadPanelOpen, setThreadPanelOpen] = useState(false);
  const [canvasMaximized, setCanvasMaximized] = useState(
    () => localStorage.getItem(STORAGE_KEYS.CANVAS_MAXIMIZED) === 'true'
  );
  const [layoutMode, setLayoutMode] = useState<
    'chat-left' | 'chat-right' | 'chat-top' | 'chat-bottom'
  >(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CHAT_LAYOUT_MODE);
    if (stored === 'chat-right' || stored === 'chat-top' || stored === 'chat-bottom') return stored;
    if (stored === 'vertical') return 'chat-top'; // migrate old value
    return 'chat-left';
  });
  const [mobileTab, setMobileTab] = useState<'chat' | 'canvas'>('chat');

  const canvasActions = useCanvasState();
  const { nodes, edges, loadState, applyUpdate, clearCanvas } = canvasActions;

  const threadManager = useThreadManager({
    initialThreadId,
    onThreadChange,
    onLoadMessages: setMessages,
    onLoadCanvas: loadState,
    onClearState: useCallback(() => {
      setMessages([]);
      clearCanvas();
      setThreadPanelOpen(false);
    }, [clearCanvas]),
  });

  const chatStream = useChatStream({
    ensureThread: threadManager.ensureThread,
    setActiveThreadId: threadManager.setActiveThreadId,
    setMessages,
    onCanvasUpdate: applyUpdate,
    fetchThreads: threadManager.fetchThreads,
  });

  const canvasOps = useCanvasOps({
    activeThreadId: threadManager.activeThreadId,
    ensureThread: threadManager.ensureThread,
    canvasActions,
  });

  const handleToggleMaximize = useCallback(() => {
    setCanvasMaximized((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.CANVAS_MAXIMIZED, String(next));
      return next;
    });
  }, []);

  const handleToggleLayout = useCallback(() => {
    setLayoutMode((prev) => {
      const cycle = [
        'chat-left',
        'chat-right',
        'chat-top',
        'chat-bottom',
      ] satisfies (typeof prev)[];
      const idx = cycle.indexOf(prev);
      const next = cycle[(idx + 1) % cycle.length];
      localStorage.setItem(STORAGE_KEYS.CHAT_LAYOUT_MODE, next);
      return next;
    });
  }, []);

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
          gap: 3,
          pb: 8,
        }}
      >
        <ChatEmptyState onPromptClick={chatStream.handleSend} />
        <Box sx={{ width: '100%', maxWidth: 680 }}>
          <ChatInput onSend={chatStream.handleSend} isStreaming={chatStream.isStreaming} elevated />
        </Box>
      </Stack>
    ) : (
      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <ChatMessages
          messages={messages}
          isLoading={threadManager.isLoadingMessages}
          isStreaming={chatStream.isStreaming}
        />
        <ChatInput onSend={chatStream.handleSend} isStreaming={chatStream.isStreaming} />
      </Stack>
    );

  const canvasContent = (
    <Canvas
      nodes={nodes}
      edges={edges}
      onDeleteCard={canvasOps.handleDeleteCard}
      onMoveCard={canvasOps.handleMoveCard}
      onEdgesChange={canvasOps.handleEdgesChange}
      onAddEdge={canvasOps.handleAddEdge}
      onDeleteEdge={canvasOps.handleDeleteEdge}
      onComponentEdit={canvasOps.handleComponentEdit}
      onTitleEdit={canvasOps.handleTitleEdit}
      onResizeCard={canvasOps.handleResizeCard}
      onReorderCard={canvasOps.handleReorderCard}
      onAddCard={canvasOps.handleAddCard}
      isMaximized={canvasMaximized}
      onToggleMaximize={handleToggleMaximize}
    />
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
        /* Mobile: single row — [Chat|Canvas] tabs + actions + hamburger */
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            height: 44,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: alpha(ct, 0.06),
            gap: 0.5,
          }}
        >
          <Tabs
            value={mobileTab}
            onChange={(_, v) => setMobileTab(v)}
            sx={{
              flex: 1,
              minHeight: 36,
              '& .MuiTabs-indicator': { height: 2 },
              '& .MuiTab-root': {
                minHeight: 36,
                minWidth: 0,
                py: 0,
                px: 1.5,
                fontSize: '0.8rem',
                textTransform: 'none',
                fontWeight: 500,
              },
            }}
          >
            <Tab label="Chat" value="chat" />
            <Tab label="Canvas" value="canvas" />
          </Tabs>
          <IconButton
            size="small"
            onClick={threadManager.handleNewThread}
            sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
          >
            <PlusIcon size={18} weight="light" color="currentColor" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setThreadPanelOpen(true)}
            sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
          >
            <ClockCounterClockwiseIcon size={18} weight="light" color="currentColor" />
          </IconButton>
          <Box sx={{ width: '1px', height: 20, bgcolor: alpha(ct, 0.08) }} />
          <IconButton size="small" onClick={toggleMobileSidebar} sx={{ color: 'text.primary' }}>
            <ListIcon size={20} weight="regular" />
          </IconButton>
        </Box>
      ) : (
        /* Desktop: standard top bar */
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            height: headerHeight,
            flexShrink: 0,
            borderBottom: '1px solid',
            borderColor: alpha(ct, 0.06),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {headerSlot}
            {activeThread && (
              <>
                {headerSlot && (
                  <Box sx={{ width: '1px', height: 20, bgcolor: alpha(ct, 0.1), flexShrink: 0 }} />
                )}
                <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }} noWrap>
                  {activeThread.title ?? 'Untitled'}
                </Typography>
              </>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="New chat">
              <IconButton
                size="small"
                onClick={threadManager.handleNewThread}
                sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
              >
                <PlusIcon size={18} weight="light" color="currentColor" />
              </IconButton>
            </Tooltip>
            <Tooltip title="History">
              <IconButton
                size="small"
                onClick={() => setThreadPanelOpen(true)}
                sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
              >
                <ClockCounterClockwiseIcon size={18} weight="light" color="currentColor" />
              </IconButton>
            </Tooltip>
            {threadManager.activeThreadId && (
              <ShareButton threadId={threadManager.activeThreadId} />
            )}
            <Tooltip
              title={
                {
                  'chat-left': 'Chat left',
                  'chat-right': 'Chat right',
                  'chat-top': 'Chat top',
                  'chat-bottom': 'Chat bottom',
                }[layoutMode]
              }
            >
              <IconButton
                size="small"
                onClick={handleToggleLayout}
                sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
              >
                {
                  {
                    'chat-left': (
                      <SidebarSimpleIcon size={18} weight="light" color="currentColor" />
                    ),
                    'chat-right': (
                      <SidebarSimpleIcon
                        size={18}
                        weight="light"
                        color="currentColor"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    ),
                    'chat-top': (
                      <SidebarSimpleIcon
                        size={18}
                        weight="light"
                        color="currentColor"
                        style={{ transform: 'rotate(90deg)' }}
                      />
                    ),
                    'chat-bottom': (
                      <SidebarSimpleIcon
                        size={18}
                        weight="light"
                        color="currentColor"
                        style={{ transform: 'rotate(-90deg)' }}
                      />
                    ),
                  }[layoutMode]
                }
              </IconButton>
            </Tooltip>
            {trailingSlot}
          </Box>
        </Box>
      )}

      {threadDrawer}

      {/* Main content */}
      {isMobile ? (
        /* Mobile: show one panel at a time */
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'chat' ? (
            chatContent
          ) : (
            <Box sx={{ flex: 1, minHeight: 0 }}>{canvasContent}</Box>
          )}
        </Box>
      ) : (
        /* Desktop: resizable split layout */
        <Box
          sx={{
            display: 'flex',
            flexDirection: {
              'chat-left': 'row',
              'chat-right': 'row-reverse',
              'chat-top': 'column',
              'chat-bottom': 'column-reverse',
            }[layoutMode],
            flex: 1,
            minHeight: 0,
          }}
        >
          {!canvasMaximized && (
            <ResizablePanel
              key={layoutMode}
              direction={
                layoutMode === 'chat-left' || layoutMode === 'chat-right'
                  ? 'horizontal'
                  : 'vertical'
              }
              defaultSize={
                layoutMode === 'chat-left' || layoutMode === 'chat-right'
                  ? Math.round(window.innerWidth * 0.4)
                  : Math.round(window.innerHeight * 0.4)
              }
              minSize={layoutMode === 'chat-left' || layoutMode === 'chat-right' ? 320 : 200}
              maxSize={layoutMode === 'chat-left' || layoutMode === 'chat-right' ? 900 : 800}
              storageKey={
                layoutMode === 'chat-left' || layoutMode === 'chat-right'
                  ? STORAGE_KEYS.CHAT_PANEL_WIDTH
                  : STORAGE_KEYS.CHAT_PANEL_HEIGHT
              }
              resizeFrom={layoutMode === 'chat-left' || layoutMode === 'chat-top' ? 'end' : 'start'}
              sx={{ minWidth: 0, minHeight: 0 }}
            >
              {chatContent}
            </ResizablePanel>
          )}

          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>{canvasContent}</Box>
        </Box>
      )}

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
