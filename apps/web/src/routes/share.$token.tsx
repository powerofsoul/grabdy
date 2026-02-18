import { useEffect, useState } from 'react';

import type { CanvasState } from '@grabdy/contracts';
import { Box, Button, CircularProgress, Typography, alpha, useTheme } from '@mui/material';
import { LockIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { SharedChatView } from '@/components/shared-chat/SharedChatView';
import type { ChatMessage } from '@/components/chat/types';
import { api, ApiError } from '@/lib/api';

export const Route = createFileRoute('/share/$token')({
  component: SharedChatPage,
});

interface SnapshotData {
  title: string | null;
  messages: ChatMessage[];
  canvasState: CanvasState | null;
}

type PageState = 'loading' | 'success' | 'not_found' | 'unauthorized';

function SharedChatPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<SnapshotData | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.sharedChats.getSharedChat({
          params: { shareToken: token },
        });
        if (res.status === 200) {
          setData({
            title: res.body.data.title,
            messages: res.body.data.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              sources: m.sources ?? undefined,
            })),
            canvasState: res.body.data.canvasState,
          });
          setPageState('success');
        } else {
          setPageState('not_found');
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setPageState('unauthorized');
        } else {
          setPageState('not_found');
        }
      }
    }
    load();
  }, [token]);

  if (pageState === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (pageState === 'unauthorized') {
    return <SharedChatUnauthorized />;
  }

  if (pageState === 'not_found' || !data) {
    return <SharedChatNotFound />;
  }

  return <SharedChatView title={data.title} messages={data.messages} canvasState={data.canvasState} />;
}

function SharedChatUnauthorized() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        bgcolor: 'background.default',
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: alpha(ct, 0.04),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
        }}
      >
        <LockIcon size={36} weight="light" color={alpha(ct, 0.2)} />
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 500, color: 'text.primary', mb: 1 }}>
        Sign in to view this chat
      </Typography>
      <Typography sx={{ fontSize: 14, color: alpha(ct, 0.4), maxWidth: 360, mb: 4 }}>
        This shared conversation is only available to organization members. Sign in to continue.
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate({ to: '/auth/login' })}
        sx={{ fontWeight: 600, fontSize: 14, px: 3, py: 1 }}
      >
        Sign in
      </Button>
    </Box>
  );
}

function SharedChatNotFound() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        textAlign: 'center',
        bgcolor: 'background.default',
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: alpha(ct, 0.04),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 4,
        }}
      >
        <MagnifyingGlassIcon size={36} weight="light" color={alpha(ct, 0.2)} />
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 500, color: 'text.primary', mb: 1 }}>
        This shared chat is not available
      </Typography>
      <Typography sx={{ fontSize: 14, color: alpha(ct, 0.4), maxWidth: 360 }}>
        The link may have been revoked, or the conversation no longer exists.
      </Typography>
    </Box>
  );
}
