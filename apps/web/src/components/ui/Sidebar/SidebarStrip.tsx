import { alpha, Avatar, Box, IconButton, Tooltip, useTheme } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import { LogOut, Moon, Sun } from 'lucide-react';

const FONT_SERIF = '"Source Serif 4", "Georgia", serif';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';

function StripDot({ to, label, exact }: { to: string; label: string; exact?: boolean }) {
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
            bgcolor: isActive ? alpha(ct, 0.06) : 'transparent',
            transition: 'background-color 120ms ease',
            '&:hover': {
              bgcolor: alpha(ct, isActive ? 0.08 : 0.04),
            },
          }}
        >
          <Box
            sx={{
              width: isActive ? 7 : 5,
              height: isActive ? 7 : 5,
              borderRadius: '50%',
              bgcolor: isActive ? 'text.primary' : alpha(ct, 0.25),
              transition: 'all 150ms ease',
            }}
          />
        </Box>
      </Link>
    </Tooltip>
  );
}

export function SidebarStrip() {
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
      {/* Wordmark "g." */}
      <Link to="/dashboard/chat" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            mb: 1,
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 18,
              fontWeight: 600,
              fontFamily: FONT_SERIF,
              color: 'text.primary',
            }}
          >
            g.
          </Box>
        </Box>
      </Link>

      {/* Nav dots */}
      <StripDot to="/dashboard" label="Dashboard" exact />
      <StripDot to="/dashboard/chat" label="Chat" />
      <StripDot to="/dashboard/collections" label="Collections" />
      <StripDot to="/dashboard/api-keys" label="API Keys" />
      <StripDot to="/dashboard/members" label="Members" />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Settings dot */}
      <StripDot to="/dashboard/settings" label="Settings" />

      {/* Inline actions */}
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
