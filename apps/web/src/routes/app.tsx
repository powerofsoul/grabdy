import { alpha, Avatar, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { ArrowLeftIcon, MoonIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react';
import { createFileRoute, Navigate, useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';

import { ChatPanel } from '@/components/chat';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';

const appSearchSchema = z.object({
  thread: z.string().optional(),
});

export const Route = createFileRoute('/app')({
  component: AppPage,
  validateSearch: appSearchSchema,
});

function AppPage() {
  const { user, selectedOrgId, isAuthenticated, isAdmin, logout } = useAuth();
  const { preference, setPreference } = useThemeMode();
  const { thread } = useSearch({ from: '/app' });
  const navigate = useNavigate();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isDark = preference === 'dark';

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  if (!user || !selectedOrgId) {
    return null;
  }

  const initials = user.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

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
        initialThreadId={thread}
        onThreadChange={(threadId) => {
          navigate({
            to: '/app',
            search: threadId ? { thread: threadId } : {},
            replace: true,
          });
        }}
        headerHeight={56}
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
