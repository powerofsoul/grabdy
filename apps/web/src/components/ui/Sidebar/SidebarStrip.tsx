import type { ReactNode } from 'react';

import { alpha, Avatar, Box, IconButton, Tooltip, useTheme } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import { ChevronsRight, Folder, Key, LayoutGrid, LogOut, MessageSquare, Moon, Settings, Sun, Users } from 'lucide-react';

const FONT_SERIF = '"Source Serif 4", "Georgia", serif';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';

function StripIcon({ to, label, icon, exact }: { to: string; label: string; icon: ReactNode; exact?: boolean }) {
  const location = useLocation();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isActive = exact
    ? location.pathname === to
    : location.pathname.startsWith(to);

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
            borderRadius: 1,
            cursor: 'pointer',
            color: isActive ? 'text.primary' : alpha(ct, 0.4),
            bgcolor: isActive ? alpha(ct, 0.06) : 'transparent',
            transition: 'all 120ms ease',
            '&:hover': {
              bgcolor: alpha(ct, isActive ? 0.08 : 0.04),
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
  const { user, logout } = useAuth();
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
        borderColor: alpha(ct, 0.08),
        py: 2.5,
        gap: 0.5,
      }}
    >
      {/* Wordmark "G." */}
      <Tooltip title="Expand sidebar" placement="right">
        <Box
          onClick={onExpand}
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 1,
            '&:hover': { bgcolor: alpha(ct, 0.06) },
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 18,
              fontWeight: 600,
              fontFamily: FONT_SERIF,
              color: 'text.primary',
              lineHeight: 1,
              ml: 0.35,
            }}
          >
            G.
          </Box>
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
      <StripIcon to="/dashboard/api-keys" label="API Keys" icon={<Key size={18} strokeWidth={1.5} />} />
      <StripIcon to="/dashboard/members" label="Members" icon={<Users size={18} strokeWidth={1.5} />} />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Settings */}
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
