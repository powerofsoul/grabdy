import { alpha, Avatar, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import { Folder, Key, LayoutGrid, LogOut, MessageSquare, Moon, Plus, Settings, Sun, Users } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';

import { useSidebarCollections } from './useSidebarCollections';

const FONT_SERIF = '"Source Serif 4", "Georgia", serif';

function NavItem({ to, label, exact, icon, trailing }: {
  to: string;
  label: string;
  exact?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const location = useLocation();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isActive = exact
    ? location.pathname === to
    : location.pathname.startsWith(to);

  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 34,
          px: 2,
          mx: '8px',
          borderRadius: 1,
          cursor: 'pointer',
          bgcolor: isActive ? alpha(ct, 0.06) : 'transparent',
          transition: 'color 120ms ease, background-color 120ms ease',
          '&:hover': {
            bgcolor: alpha(ct, isActive ? 0.08 : 0.04),
          },
        }}
      >
        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: isActive ? 'text.primary' : 'text.secondary',
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          noWrap
          sx={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'text.primary' : 'text.secondary',
            lineHeight: 1.4,
          }}
        >
          {label}
        </Typography>
        {trailing}
      </Box>
    </Link>
  );
}

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: '20px', mb: 0.5 }}>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: alpha(theme.palette.text.primary, 0.35),
          lineHeight: 1.4,
        }}
      >
        {label}
      </Typography>
      {action}
    </Box>
  );
}

function CountBadge({ count }: { count: number }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  return (
    <Typography
      component="span"
      sx={{
        fontSize: 11,
        fontWeight: 500,
        color: alpha(ct, 0.35),
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count}
    </Typography>
  );
}

export function SidebarFull() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useThemeMode();
  const collections = useSidebarCollections();
  const isDark = preference === 'dark';
  const ct = theme.palette.text.primary;

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <Box
      sx={{
        width: 240,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        borderRight: '1px solid',
        borderColor: alpha(ct, 0.08),
      }}
    >
      {/* Wordmark */}
      <Box sx={{ px: '20px', pt: '20px', pb: 0 }}>
        <Link to="/dashboard/chat" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Typography
            sx={{
              fontSize: 20,
              fontWeight: 600,
              color: 'text.primary',
              fontFamily: FONT_SERIF,
              cursor: 'pointer',
              mb: '24px',
            }}
          >
            grabdy.
          </Typography>
        </Link>

        <Box sx={{ height: '1px', bgcolor: alpha(ct, 0.08), mb: '16px' }} />
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <NavItem
          to="/dashboard"
          label="Dashboard"
          exact
          icon={<LayoutGrid size={16} strokeWidth={1.5} />}
        />
        <NavItem
          to="/dashboard/chat"
          label="Chat"
          icon={<MessageSquare size={16} strokeWidth={1.5} />}
        />

        {/* Sources */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader
            label="Sources"
            action={
              <Link to="/dashboard/collections" style={{ textDecoration: 'none' }}>
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '5px',
                    border: '1px solid',
                    borderColor: alpha(ct, 0.15),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: alpha(ct, 0.35),
                    transition: 'all 120ms ease',
                    '&:hover': {
                      bgcolor: alpha(ct, 0.06),
                      borderColor: alpha(ct, 0.25),
                      color: alpha(ct, 0.6),
                    },
                  }}
                >
                  <Plus size={12} strokeWidth={2} />
                </Box>
              </Link>
            }
          />
          {collections.map((c) => (
            <NavItem
              key={c.id}
              to={`/dashboard/collections/${c.id}`}
              label={c.name}
              icon={<Folder size={15} strokeWidth={1.5} />}
              trailing={<CountBadge count={c.sourceCount} />}
            />
          ))}
        </Box>

        {/* Integrate */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader label="Integrate" />
          <NavItem
            to="/dashboard/api-keys"
            label="API Keys"
            icon={<Key size={16} strokeWidth={1.5} />}
          />
        </Box>

        {/* Team */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader label="Team" />
          <NavItem
            to="/dashboard/members"
            label="Members"
            icon={<Users size={16} strokeWidth={1.5} />}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box>
        <Box sx={{ height: '1px', bgcolor: alpha(ct, 0.08), mx: '20px', mb: '12px' }} />

        <Box sx={{ mb: '8px' }}>
          <NavItem
            to="/dashboard/settings"
            label="Settings"
            icon={<Settings size={16} strokeWidth={1.5} />}
          />
        </Box>

        <Box sx={{ height: '1px', bgcolor: alpha(ct, 0.08), mx: '20px', mb: '8px' }} />

        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: '20px',
              pb: '16px',
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                fontSize: 11,
                fontWeight: 600,
                bgcolor: 'text.primary',
                color: 'background.default',
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', lineHeight: 1.3 }}
                noWrap
              >
                {user.name}
              </Typography>
              <Typography
                sx={{ fontSize: 11, color: alpha(ct, 0.4), lineHeight: 1.3 }}
                noWrap
              >
                {user.email}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
              <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
                <IconButton
                  size="small"
                  onClick={() => setPreference(isDark ? 'light' : 'dark')}
                  sx={{
                    color: alpha(ct, 0.35),
                    p: 0.5,
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Sign out">
                <IconButton
                  size="small"
                  onClick={logout}
                  sx={{
                    color: alpha(ct, 0.35),
                    p: 0.5,
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <LogOut size={14} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
