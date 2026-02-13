import type { ReactNode } from 'react';

import { alpha, Avatar, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import { BarChart3, BookOpen, ChevronsRight, Eye, Folder, Key, LayoutGrid, LogOut, MessageSquare, Moon, Plug, Settings, Sun, Users, Waypoints } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { FONT_SERIF } from '@/theme';

function StripIcon({ to, label, icon, exact, activePrefix }: { to: string; label: string; icon: ReactNode; exact?: boolean; activePrefix?: string }) {
  const location = useLocation();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const matchPath = activePrefix ?? to;
  const isActive = exact
    ? location.pathname === matchPath
    : location.pathname.startsWith(matchPath);

  return (
    <Tooltip title={label} placement="right">
      <Link to={to} style={{ textDecoration: 'none' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 0,
            cursor: 'pointer',
            color: isActive ? 'text.primary' : alpha(ct, 0.4),
            borderLeft: isActive ? `2px solid ${ct}` : '2px solid transparent',
            bgcolor: 'transparent',
            transition: 'all 120ms ease',
            '&:hover': {
              bgcolor: alpha(ct, 0.03),
              color: 'text.primary',
            },
          }}
        >
          {icon}
        </Box>
      </Link>
    </Tooltip>
  );
}

export function SidebarStrip({ onExpand }: { onExpand?: () => void }) {
  const theme = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const { preference, setPreference } = useThemeMode();
  const isDark = preference === 'dark';
  const ct = theme.palette.text.primary;

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <Box
      sx={{
        width: 56,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        bgcolor: 'background.default',
        borderRight: '1px solid',
        borderColor: 'grey.900',
        py: 2.5,
        gap: 0.5,
      }}
    >
      {/* Logo mark */}
      <Tooltip title="Expand sidebar" placement="right">
        <Box
          onClick={onExpand}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { opacity: 0.7 },
          }}
        >
          <Typography
            sx={{
              fontSize: 22,
              fontWeight: 400,
              fontFamily: FONT_SERIF,
              color: 'text.primary',
              letterSpacing: '-0.01em',
            }}
          >
            grabdy.
          </Typography>
        </Box>
      </Tooltip>
      {onExpand && (
        <Tooltip title="Expand sidebar" placement="right">
          <IconButton
            size="small"
            onClick={onExpand}
            sx={{
              color: alpha(ct, 0.25),
              p: 0.5,
              mb: 0.5,
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ChevronsRight size={14} />
          </IconButton>
        </Tooltip>
      )}

      {/* Nav icons */}
      <StripIcon to="/dashboard" label="Dashboard" icon={<LayoutGrid size={18} strokeWidth={1.5} />} exact />
      <StripIcon to="/dashboard/chat" label="Chat" icon={<MessageSquare size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/sources" label="Sources" icon={<Folder size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/integrations" label="Integrations" icon={<Plug size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/api/keys" label="Keys" icon={<Key size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/api/docs" label="Docs" icon={<BookOpen size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/api/mcp" label="MCP" icon={<Waypoints size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/members" label="Members" icon={<Users size={18} strokeWidth={1.5} />} />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* View as Member link for admins/owners */}
      {isAdmin && (
        <Tooltip title="View as Member" placement="right">
          <Link to="/app" style={{ textDecoration: 'none' }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0,
                cursor: 'pointer',
                color: alpha(ct, 0.35),
                transition: 'all 120ms ease',
                '&:hover': {
                  bgcolor: alpha(ct, 0.03),
                  color: 'text.primary',
                },
              }}
            >
              <Eye size={16} />
            </Box>
          </Link>
        </Tooltip>
      )}

      {/* Settings */}
      <StripIcon to="/dashboard/usage" label="AI Usage" icon={<BarChart3 size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/settings" label="Settings" icon={<Settings size={18} strokeWidth={1.5} />} />

      {/* Theme toggle */}
      <Tooltip title={isDark ? 'Light mode' : 'Dark mode'} placement="right">
        <IconButton
          size="small"
          onClick={() => setPreference(isDark ? 'light' : 'dark')}
          sx={{
            color: alpha(ct, 0.35),
            p: 0.5,
            '&:hover': { color: 'text.primary' },
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
      </Tooltip>

      {/* Avatar */}
      {user && (
        <Tooltip title={user.name} placement="right">
          <Avatar
            sx={{
              width: 28,
              height: 28,
              fontSize: 11,
              fontWeight: 600,
              bgcolor: 'text.primary',
              color: 'background.default',
              cursor: 'pointer',
              mt: 0.5,
              borderRadius: 0,
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>
      )}

      {/* Sign out */}
      <Tooltip title="Sign out" placement="right">
        <IconButton
          size="small"
          onClick={logout}
          sx={{
            color: alpha(ct, 0.35),
            p: 0.5,
            mt: 0.5,
            '&:hover': { color: 'error.main' },
          }}
        >
          <LogOut size={14} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
