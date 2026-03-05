import { useState } from 'react';

import {
  alpha,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  BuildingsIcon,
  CaretDoubleLeftIcon,
  CaretUpDownIcon,
  ChartBarIcon,
  ChatCircleIcon,
  CheckIcon,
  CreditCardIcon,
  EyeIcon,
  FileTextIcon,
  FolderIcon,
  GearIcon,
  MoonIcon,
  SignOutIcon,
  SquaresFourIcon,
  SunIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { Link, useNavigate } from '@tanstack/react-router';

import { NavItem } from './NavItem';
import { SectionHeader } from './SectionHeader';
import { useSidebarSources } from './useSidebarSources';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';

export function SidebarFull({ onCollapse }: { onCollapse?: () => void }) {
  const theme = useTheme();
  const { user, logout, isAdmin, selectedOrgId, selectOrg } = useAuth();
  const { preference, setPreference } = useThemeMode();
  useSidebarSources();
  const navigate = useNavigate();
  const isDark = preference === 'dark';
  const ct = theme.palette.text.primary;
  const [orgMenuAnchor, setOrgMenuAnchor] = useState<HTMLElement | null>(null);

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
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
        borderColor: 'divider',
      }}
    >
      {/* Logo + collapse */}
      <Box sx={{ px: '20px', pt: '20px', pb: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: '24px',
            position: 'relative',
          }}
        >
          <Link to="/dashboard/chat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography variant="h5" sx={{ fontSize: 22, color: 'text.primary' }}>
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
                <CaretDoubleLeftIcon size={16} weight="light" color="currentColor" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'divider' }} />
      </Box>

      {/* Org switcher */}
      {user && user.memberships.length > 0 && (
        <>
          {user.memberships.length >= 2 ? (
            <Box
              onClick={(e) => setOrgMenuAnchor(e.currentTarget)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                height: 34,
                px: 2,
                mx: '8px',
                mt: '12px',
                mb: '4px',
                cursor: 'pointer',
                borderRadius: 0,
                transition: 'all 120ms ease',
                '&:hover': { bgcolor: alpha(ct, 0.04) },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', color: alpha(ct, 0.5) }}>
                <BuildingsIcon size={16} weight="light" color="currentColor" />
              </Box>
              <Typography
                sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', flex: 1 }}
                noWrap
              >
                {user.memberships.find((m) => m.orgId === selectedOrgId)?.orgName ?? 'Select org'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', color: alpha(ct, 0.3) }}>
                <CaretUpDownIcon size={14} weight="light" color="currentColor" />
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                height: 34,
                px: 2,
                mx: '8px',
                mt: '12px',
                mb: '4px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', color: alpha(ct, 0.5) }}>
                <BuildingsIcon size={16} weight="light" color="currentColor" />
              </Box>
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }} noWrap>
                {user.memberships[0].orgName}
              </Typography>
            </Box>
          )}
          <Menu
            anchorEl={orgMenuAnchor}
            open={!!orgMenuAnchor}
            onClose={() => setOrgMenuAnchor(null)}
            slotProps={{
              paper: {
                sx: { minWidth: 200, mt: 0.5 },
              },
            }}
          >
            {user.memberships.map((m) => (
              <MenuItem
                key={m.id}
                selected={m.orgId === selectedOrgId}
                onClick={() => {
                  if (m.orgId !== selectedOrgId) {
                    selectOrg(m.orgId);
                    navigate({ to: '/dashboard' });
                  }
                  setOrgMenuAnchor(null);
                }}
                sx={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 2 }}
              >
                {m.orgName}
                {m.orgId === selectedOrgId && (
                  <CheckIcon size={14} weight="light" color="currentColor" />
                )}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      {/* Nav */}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <NavItem
            to="/dashboard"
            label="Dashboard"
            exact
            icon={<SquaresFourIcon size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/chat"
            label="Chat"
            icon={<ChatCircleIcon size={16} weight="light" color="currentColor" />}
          />
        </Box>

        {/* Data */}
        <Box>
          <SectionHeader label="Data" />
          <NavItem
            to="/dashboard/contracts"
            label="Contracts"
            icon={<FileTextIcon size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/sources"
            label="Sources"
            icon={<FolderIcon size={16} weight="light" color="currentColor" />}
          />
        </Box>

        {/* Team */}
        <Box>
          <SectionHeader label="Team" />
          <NavItem
            to="/dashboard/members"
            label="Members"
            icon={<UsersIcon size={16} weight="light" color="currentColor" />}
          />
        </Box>
      </Box>

      {/* Footer */}
      <Box>
        <Box sx={{ height: '1px', bgcolor: 'divider', mx: '20px', mb: '12px' }} />

        {/* View as Member link for admins/owners */}
        {isAdmin && (
          <>
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
                  <EyeIcon size={14} weight="light" color="currentColor" />
                </Box>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>
                  View as Member
                </Typography>
              </Box>
            </Link>
            <Box sx={{ height: '1px', bgcolor: 'divider', mx: '20px', mb: '12px' }} />
          </>
        )}

        <Box sx={{ mb: '8px', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <NavItem
            to="/dashboard/usage"
            label="AI Usage"
            icon={<ChartBarIcon size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/billing"
            label="Billing"
            icon={<CreditCardIcon size={16} weight="light" color="currentColor" />}
          />
          <NavItem
            to="/dashboard/settings"
            label="Settings"
            icon={<GearIcon size={16} weight="light" color="currentColor" />}
          />
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'divider', mx: '20px', mb: '8px' }} />

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
                {`${user.firstName} ${user.lastName}`.trim()}
              </Typography>
              <Typography sx={{ fontSize: 11, color: alpha(ct, 0.4), lineHeight: 1.3 }} noWrap>
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
                  {isDark ? (
                    <SunIcon size={14} weight="light" color="currentColor" />
                  ) : (
                    <MoonIcon size={14} weight="light" color="currentColor" />
                  )}
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
                  <SignOutIcon size={14} weight="light" color="currentColor" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
