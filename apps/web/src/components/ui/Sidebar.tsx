import {
  Box,
  Drawer as MuiDrawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';
import {
  Database,
  FolderOpen,
  Key,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from 'lucide-react';

import { useDrawer } from '@/context/DrawerContext';

import { Logo } from './Logo';

const NAV_ITEMS = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Overview', exact: true },
  { to: '/dashboard/collections', icon: <FolderOpen size={20} />, label: 'Collections' },
  { to: '/dashboard/sources', icon: <Database size={20} />, label: 'Data Sources' },
  { to: '/dashboard/api-keys', icon: <Key size={20} />, label: 'API Keys' },
  { to: '/dashboard/chat', icon: <MessageSquare size={20} />, label: 'Chat' },
  { to: '/dashboard/settings', icon: <Settings size={20} />, label: 'Settings' },
];

const DRAWER_WIDTH = 240;

function SidebarContent() {
  const location = useLocation();

  return (
    <>
      <Box sx={{ p: 2 }}>
        <Logo />
      </Box>
      <List sx={{ px: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <Link key={item.to} to={item.to} style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton
                selected={isActive}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </Link>
          );
        })}
      </List>
    </>
  );
}

export function Sidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { drawerCount, popDrawer } = useDrawer();
  const _mobileOpen = drawerCount > 0 && isMobile;

  if (isMobile) {
    return (
      <MuiDrawer
        variant="temporary"
        open={_mobileOpen}
        onClose={popDrawer}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <SidebarContent />
      </MuiDrawer>
    );
  }

  return (
    <MuiDrawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <SidebarContent />
    </MuiDrawer>
  );
}
