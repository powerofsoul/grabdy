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
  CaretDoubleRightIcon,
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

import { StripIcon } from './StripIcon';

import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';

export function SidebarStrip({ onExpand }: { onExpand?: () => void }) {
  const theme = useTheme();
  const { user, logout, isAdmin, selectedOrgId, selectOrg } = useAuth();
  const { preference, setPreference } = useThemeMode();
  const navigate = useNavigate();
  const isDark = preference === 'dark';
  const ct = theme.palette.text.primary;
  const [orgMenuAnchor, setOrgMenuAnchor] = useState<HTMLElement | null>(null);
  const currentOrgName = user?.memberships.find((m) => m.orgId === selectedOrgId)?.orgName;

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
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
          <Typography variant="h5" sx={{ fontSize: 22, color: 'text.primary' }}>
            g.
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
            <CaretDoubleRightIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Tooltip>
      )}

      {/* Org switcher */}
      {user && user.memberships.length >= 2 && (
        <>
          <Tooltip title={currentOrgName ?? 'Switch organization'} placement="right">
            <Box
              onClick={(e) => setOrgMenuAnchor(e.currentTarget)}
              sx={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: alpha(ct, 0.4),
                transition: 'all 120ms ease',
                '&:hover': {
                  bgcolor: alpha(ct, 0.03),
                  color: 'text.primary',
                },
              }}
            >
              <BuildingsIcon size={18} weight="light" color="currentColor" />
            </Box>
          </Tooltip>
          <Menu
            anchorEl={orgMenuAnchor}
            open={!!orgMenuAnchor}
            onClose={() => setOrgMenuAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            slotProps={{
              paper: {
                sx: { minWidth: 200, ml: 1 },
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
                  <CheckIcon size={14} weight="bold" color="currentColor" />
                )}
              </MenuItem>
            ))}
          </Menu>
          <Box sx={{ width: 28, height: '1px', bgcolor: 'grey.900', my: 0.5 }} />
        </>
      )}

      {/* Nav icons */}
      <StripIcon
        to="/dashboard"
        label="Dashboard"
        icon={<SquaresFourIcon size={18} weight="light" color="currentColor" />}
        exact
      />
      <StripIcon
        to="/dashboard/chat"
        label="Chat"
        icon={<ChatCircleIcon size={18} weight="light" color="currentColor" />}
      />
      <StripIcon
        to="/dashboard/contracts"
        label="Contracts"
        icon={<FileTextIcon size={18} weight="light" color="currentColor" />}
      />
      <StripIcon
        to="/dashboard/sources"
        label="Sources"
        icon={<FolderIcon size={18} weight="light" color="currentColor" />}
      />
      <StripIcon
        to="/dashboard/members"
        label="Members"
        icon={<UsersIcon size={18} weight="light" color="currentColor" />}
      />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* View as Member link for admins/owners */}
      {isAdmin && (
        <>
          <Box sx={{ width: 28, height: '1px', bgcolor: 'grey.900', my: 0.5 }} />
          <Tooltip title="View as Member" placement="right">
            <Link to="/app" style={{ textDecoration: 'none' }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: alpha(ct, 0.35),
                  transition: 'all 120ms ease',
                  '&:hover': {
                    bgcolor: alpha(ct, 0.03),
                    color: 'text.primary',
                  },
                }}
              >
                <EyeIcon size={16} weight="light" color="currentColor" />
              </Box>
            </Link>
          </Tooltip>
          <Box sx={{ width: 28, height: '1px', bgcolor: 'grey.900', my: 0.5 }} />
        </>
      )}

      {/* Settings */}
      <StripIcon
        to="/dashboard/usage"
        label="AI Usage"
        icon={<ChartBarIcon size={18} weight="light" color="currentColor" />}
      />
      <StripIcon
        to="/dashboard/billing"
        label="Billing"
        icon={<CreditCardIcon size={18} weight="light" color="currentColor" />}
      />
      <StripIcon
        to="/dashboard/settings"
        label="Settings"
        icon={<GearIcon size={18} weight="light" color="currentColor" />}
      />

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
          {isDark ? (
            <SunIcon size={16} weight="light" color="currentColor" />
          ) : (
            <MoonIcon size={16} weight="light" color="currentColor" />
          )}
        </IconButton>
      </Tooltip>

      {/* Avatar */}
      {user && (
        <Tooltip title={`${user.firstName} ${user.lastName}`.trim()} placement="right">
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
          <SignOutIcon size={14} weight="light" color="currentColor" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
