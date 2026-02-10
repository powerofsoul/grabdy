import { useState } from 'react';

import {
  Avatar,
  Box,
  Divider,
  Drawer as MuiDrawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FolderOpen,
  Key,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  X,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { STORAGE_KEYS } from '@/lib/storage-keys';

import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/dashboard/collections', icon: FolderOpen, label: 'Collections' },
  { to: '/dashboard/sources', icon: Database, label: 'Data Sources' },
  { to: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  { to: '/dashboard/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
] satisfies ReadonlyArray<{ to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }>;

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 72;

function SidebarContent({ collapsed, onToggle, isMobile, onMobileClose }: {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  onMobileClose?: () => void;
}) {
  const location = useLocation();
  const { user, selectedOrgId, selectOrg, logout } = useAuth();
  const [orgMenuAnchor, setOrgMenuAnchor] = useState<HTMLElement | null>(null);

  const memberships = user?.memberships ?? [];
  const selectedOrg = memberships.find((m) => m.orgId === selectedOrgId);
  const showOrgSwitcher = memberships.length > 1;

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      {/* Logo + collapse/close */}
      <Box
        sx={{
          p: collapsed ? 1.5 : 2,
          display: 'flex',
          alignItems: collapsed ? 'center' : 'flex-start',
          justifyContent: 'space-between',
          flexDirection: collapsed ? 'column' : 'row',
          gap: collapsed ? 1 : 0,
        }}
      >
        {collapsed ? (
          <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Logo size="sm" />
          </Box>
        ) : (
          <Logo />
        )}
        {isMobile ? (
          <IconButton size="small" onClick={onMobileClose} sx={{ color: 'text.secondary' }}>
            <X size={18} />
          </IconButton>
        ) : (
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
            <IconButton size="small" onClick={onToggle} sx={{ color: 'text.secondary' }}>
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Org switcher */}
      {showOrgSwitcher && !collapsed && (
        <>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Box
              onClick={(e) => setOrgMenuAnchor(e.currentTarget)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'grey.50' },
              }}
            >
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }} noWrap>
                {selectedOrg?.orgName ?? 'Select org'}
              </Typography>
              <ChevronDown size={14} />
            </Box>
            <Menu
              anchorEl={orgMenuAnchor}
              open={Boolean(orgMenuAnchor)}
              onClose={() => setOrgMenuAnchor(null)}
              slotProps={{ paper: { sx: { minWidth: 180 } } }}
            >
              {memberships.map((m) => (
                <MenuItem
                  key={m.orgId}
                  selected={m.orgId === selectedOrgId}
                  onClick={() => {
                    selectOrg(m.orgId);
                    setOrgMenuAnchor(null);
                  }}
                >
                  {m.orgName}
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <Divider />
        </>
      )}

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1, py: 1, overflow: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          const Icon = item.icon;

          return (
            <Tooltip key={item.to} title={collapsed ? item.label : ''} placement="right">
              <Link to={item.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ListItemButton
                  selected={isActive}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    minHeight: 40,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1.5 : 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'inherit' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit' }}>
                    <Icon size={20} />
                  </ListItemIcon>
                  {!collapsed && <ListItemText primary={item.label} />}
                </ListItemButton>
              </Link>
            </Tooltip>
          );
        })}
      </List>

      {/* Bottom section: theme + user */}
      <Divider />
      <Box sx={{ p: collapsed ? 1 : 2 }}>
        {/* Theme toggle */}
        <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start', mb: 1.5 }}>
          <ThemeToggle />
        </Box>

        {/* User profile + logout */}
        {user && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.75rem',
                fontWeight: 600,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              {initials}
            </Avatar>
            {!collapsed && (
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }} noWrap>
                  {user.name}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }} noWrap>
                  {user.email}
                </Typography>
              </Box>
            )}
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={logout} sx={{ color: 'text.secondary' }}>
                <LogOut size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function Sidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
    return stored === 'true';
  });

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
  };

  const currentWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  if (isMobile) {
    return (
      <MuiDrawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
      >
        <SidebarContent
          collapsed={false}
          onToggle={handleToggle}
          isMobile
          onMobileClose={() => setMobileOpen(false)}
        />
      </MuiDrawer>
    );
  }

  return (
    <MuiDrawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.2s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <SidebarContent collapsed={collapsed} onToggle={handleToggle} isMobile={false} />
    </MuiDrawer>
  );
}
