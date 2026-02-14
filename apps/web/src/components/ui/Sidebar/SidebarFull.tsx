import { alpha, Avatar, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import { ChartBar, BookOpen, CaretRight, CaretDoubleLeft, Eye, Folder, Key, SquaresFour, SignOut, ChatCircle, Moon, Plug, Gear, Sun, Users, GitFork } from '@phosphor-icons/react';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { FONT_MONO } from '@/theme';

import { useSidebarCollections } from './useSidebarCollections';

function NavItem({ to, label, exact, icon, trailing, activePrefix }: {
  to: string;
  label: string;
  exact?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  activePrefix?: string;
}) {
  const location = useLocation();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const matchPath = activePrefix ?? to;
  const isActive = exact
    ? location.pathname === matchPath
    : location.pathname.startsWith(matchPath);

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

          cursor: 'pointer',
          borderLeft: isActive ? `2px solid ${ct}` : '2px solid transparent',
          bgcolor: 'transparent',
          transition: 'color 120ms ease, border-color 120ms ease',
          '&:hover': {
            bgcolor: alpha(ct, 0.03),
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

function SectionHeader({ label, to }: { label: string; to?: string }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  const content = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        ...(to && {
          cursor: 'pointer',
          '&:hover .section-label': { color: alpha(ct, 0.6) },
          '&:hover .section-arrow': { opacity: 1 },
        }),
      }}
    >
      <Typography
        variant="overline"
        className="section-label"
        sx={{
          color: alpha(ct, 0.35),
          transition: 'color 120ms ease',
        }}
      >
        {label}
      </Typography>
      {to && (
        <Box
          className="section-arrow"
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: alpha(ct, 0.35),
            opacity: 0,
            transition: 'opacity 120ms ease',
          }}
        >
          <CaretRight size={12} weight="light" color="currentColor" />
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: '20px', mb: 0.5 }}>
      {to ? (
        <Link to={to} style={{ textDecoration: 'none' }}>
          {content}
        </Link>
      ) : (
        content
      )}
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
        fontFamily: FONT_MONO,
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

export function SidebarFull({ onCollapse }: { onCollapse?: () => void }) {
  const theme = useTheme();
  const { user, logout, isAdmin } = useAuth();
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
        borderColor: 'grey.900',
      }}
    >
      {/* Logo + collapse */}
      <Box sx={{ px: '20px', pt: '20px', pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '24px', position: 'relative' }}>
          <Link to="/dashboard/chat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography
              variant="h5"
              sx={{ fontSize: 22, color: 'text.primary' }}
            >
              grabdy.
            </Typography>
          </Link>
          {onCollapse && (
            <Tooltip title="Collapse sidebar">
              <IconButton
                size="small"
                onClick={onCollapse}
                sx={{
                  position: 'absolute',
                  right: 0,
                  color: alpha(ct, 0.3),
                  p: 0.5,
                  '&:hover': { color: 'text.primary' },
                }}
              >
                <CaretDoubleLeft size={16} weight="light" color="currentColor" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'grey.900', mb: '16px' }} />
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <NavItem
          to="/dashboard"
          label="Dashboard"
          exact
          icon={<SquaresFour size={16} weight="light" color="currentColor" />}
        />
        <NavItem
          to="/dashboard/chat"
          label="Chat"
          icon={<ChatCircle size={16} weight="light" color="currentColor" />}
        />

        {/* Sources */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader
            label="Sources"
            to="/dashboard/sources"
          />
          {collections.map((c) => (
            <NavItem
              key={c.id}
              to={`/dashboard/sources/${c.id}`}
              label={c.name}
              icon={<Folder size={15} weight="light" color="currentColor" />}
              trailing={<CountBadge count={c.sourceCount} />}
            />
          ))}
        </Box>

        {/* Integrate */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader label="Integrate" />
          <NavItem
            to="/dashboard/integrations"
            label="Integrations"
            icon={<Plug size={16} weight="light" color="currentColor" />}
          />
        </Box>

        {/* API */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader label="API" />
          <NavItem
            to="/dashboard/api/keys"
            label="Keys"
            icon={<Key size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/api/docs"
            label="Docs"
            icon={<BookOpen size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/api/mcp"
            label="MCP"
            icon={<GitFork size={16} weight="light" color="currentColor" />}
          />
        </Box>

        {/* Team */}
        <Box sx={{ mt: 2.5 }}>
          <SectionHeader label="Team" />
          <NavItem
            to="/dashboard/members"
            label="Members"
            icon={<Users size={16} weight="light" color="currentColor" />}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box>
        {/* View as Member link for admins/owners */}
        {isAdmin && (
          <Link to="/app" style={{ textDecoration: 'none' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mx: '12px',
                mb: '8px',
                px: 1.5,
                py: 0.75,
      
                cursor: 'pointer',
                border: '1px solid',
                borderColor: alpha(ct, 0.1),
                transition: 'all 120ms ease',
                '&:hover': {
                  bgcolor: alpha(ct, 0.03),
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', color: alpha(ct, 0.4) }}>
                <Eye size={14} weight="light" color="currentColor" />
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>
                View as Member
              </Typography>
            </Box>
          </Link>
        )}

        <Box sx={{ height: '1px', bgcolor: 'grey.900', mx: '20px', mb: '12px' }} />

        <Box sx={{ mb: '8px', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <NavItem
            to="/dashboard/usage"
            label="AI Usage"
            icon={<ChartBar size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/settings"
            label="Settings"
            icon={<Gear size={16} weight="light" color="currentColor" />}
          />
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'grey.900', mx: '20px', mb: '8px' }} />

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
                  {isDark ? <Sun size={14} weight="light" color="currentColor" /> : <Moon size={14} weight="light" color="currentColor" />}
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
                  <SignOut size={14} weight="light" color="currentColor" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
