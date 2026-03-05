import { useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';
import {
  alpha,
  Avatar,
  Box,
  IconButton,
  keyframes,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ArrowLeftIcon, MoonIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';

import { ChatPanel } from '@/components/chat';
import { ChatBotTabs } from '@/components/chat/components/ChatBotTabs';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { api } from '@/lib/api';

const appSearchSchema = z.object({
  thread: z.string().optional(),
  bot: z.string().optional(),
});

export const Route = createFileRoute('/app')({
  validateSearch: appSearchSchema,
  component: AppPage,
});

function AppPage() {
  const { user, selectedOrgId, isAuthenticated, isLoading, isAdmin, logout } = useAuth();
  const { preference, setPreference } = useThemeMode();
  const { thread, bot: botParam } = useSearch({ from: '/app' });
  const navigate = useNavigate();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isDark = preference === 'dark';

  const parsedBotId = botParam ? dbIdSchema('Bot').safeParse(botParam) : undefined;
  const [activeBotId, setActiveBotId] = useState<DbId<'Bot'> | undefined>(
    parsedBotId?.success ? parsedBotId.data : undefined
  );

  const { data: bot } = useQuery({
    queryKey: ['bot', selectedOrgId, activeBotId],
    queryFn: async () => {
      if (!selectedOrgId || !activeBotId) return null;
      const res = await api.bots.get({
        params: { orgId: selectedOrgId, botId: activeBotId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedOrgId && !!activeBotId,
  });

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          bgcolor: 'background.default',
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: 28,
            color: 'text.primary',
            animation: `${keyframes`0%, 100% { opacity: 1 } 50% { opacity: 0.3 }`} 1.5s ease-in-out infinite`,
          }}
        >
          grabdy.
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          Warming up the neurons...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  if (!user || !selectedOrgId) {
    return null;
  }

  const initials = user.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const handleBotChange = (botId: string | undefined) => {
    const parsed = botId ? dbIdSchema('Bot').safeParse(botId) : undefined;
    const newBotId = parsed?.success ? parsed.data : undefined;
    setActiveBotId(newBotId);
    navigate({
      to: '/app',
      search: newBotId ? { bot: newBotId } : {},
      replace: true,
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.default',
      }}
    >
      <ChatPanel
        key={activeBotId ?? '__general__'}
        initialThreadId={thread}
        botId={activeBotId}
        tabsSlot={
          <ChatBotTabs
            currentBotId={activeBotId}
            accentColor={bot?.accentColor ?? undefined}
            onBotChange={handleBotChange}
          />
        }
        botTitle={bot?.title ?? undefined}
        botSubtitle={bot?.subtitle ?? undefined}
        botPlaceholder={bot?.placeholder ?? undefined}
        botImageUrl={bot?.imageUrl ?? undefined}
        botAccentColor={bot?.accentColor ?? undefined}
        botPrimaryColor={bot?.primaryColor ?? undefined}
        onThreadChange={(threadId) => {
          navigate({
            to: '/app',
            search: {
              ...(threadId ? { thread: threadId } : {}),
              ...(activeBotId ? { bot: activeBotId } : {}),
            },
            replace: true,
          });
        }}
        headerHeight={56}
        showMobileSidebar={false}
        headerSlot={
          <>
            {isAdmin && (
              <Tooltip title="Back to Dashboard">
                <IconButton
                  size="small"
                  onClick={() => navigate({ to: '/dashboard' })}
                  sx={{ color: alpha(ct, 0.5), mr: 0.5, '&:hover': { color: 'text.primary' } }}
                >
                  <ArrowLeftIcon size={18} weight="light" color="currentColor" />
                </IconButton>
              </Tooltip>
            )}
            <Typography
              variant="h5"
              onClick={() => {
                setActiveBotId(undefined);
                navigate({ to: '/app', search: {}, replace: true });
              }}
              sx={{
                fontSize: 18,
                color: 'text.primary',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              grabdy.
            </Typography>
          </>
        }
        trailingSlot={
          <>
            <Box sx={{ width: '1px', height: 20, bgcolor: alpha(ct, 0.08), mx: 0.5 }} />
            <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
              <IconButton
                size="small"
                onClick={() => setPreference(isDark ? 'light' : 'dark')}
                sx={{ color: alpha(ct, 0.35), '&:hover': { color: 'text.primary' } }}
              >
                {isDark ? (
                  <SunIcon size={16} weight="light" color="currentColor" />
                ) : (
                  <MoonIcon size={16} weight="light" color="currentColor" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Sign out">
              <IconButton
                size="small"
                onClick={logout}
                sx={{ color: alpha(ct, 0.35), '&:hover': { color: 'error.main' } }}
              >
                <SignOutIcon size={16} weight="light" color="currentColor" />
              </IconButton>
            </Tooltip>
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: 11,
                fontWeight: 600,
                bgcolor: 'text.primary',
                color: 'background.default',
                ml: 0.5,
              }}
            >
              {initials}
            </Avatar>
          </>
        }
      />
    </Box>
  );
}
