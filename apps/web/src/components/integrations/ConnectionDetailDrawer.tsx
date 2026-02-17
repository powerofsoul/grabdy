import { useState } from 'react';

import type { ConnectionStatus, IntegrationProvider } from '@grabdy/contracts';
import {
  alpha,
  Box,
  Button,
  Divider,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CheckIcon,
  PauseIcon,
  PlugsConnectedIcon,
  TrashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

import { getProviderLabel, ProviderIcon } from './ProviderIcon';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface ConnectionDetailDrawerProps extends DrawerProps {
  provider: IntegrationProvider;
  status: string;
  lastSyncedAt: string | null;
  externalAccountName: string | null;
  syncScheduleLabel: string | null;
  onRefresh: () => void;
  onConnect?: (provider: IntegrationProvider) => void;
}

const STATUS_MAP: Record<ConnectionStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Connected', color: 'success.main' },
  ERROR: { label: 'Error', color: 'error.main' },
  PAUSED: { label: 'Paused', color: 'warning.main' },
  DISCONNECTED: { label: 'Disconnected', color: 'text.disabled' },
};

function isConnectionStatus(value: string): value is ConnectionStatus {
  return value in STATUS_MAP;
}

function StatusIcon({ status }: { status: ConnectionStatus }) {
  const theme = useTheme();
  const iconProps = { size: 14, weight: 'light' } as const;
  const colorMap: Record<ConnectionStatus, string> = {
    ACTIVE: theme.palette.success.main,
    ERROR: theme.palette.error.main,
    PAUSED: theme.palette.warning.main,
    DISCONNECTED: theme.palette.text.disabled,
  };
  const color = colorMap[status];

  const icons: Record<ConnectionStatus, React.ReactNode> = {
    ACTIVE: <CheckIcon {...iconProps} color={color} />,
    ERROR: <WarningCircleIcon {...iconProps} color={color} />,
    PAUSED: <PauseIcon {...iconProps} color={color} />,
    DISCONNECTED: <PlugsConnectedIcon {...iconProps} color={color} />,
  };

  return <>{icons[status]}</>;
}

function StatusIndicator({ status }: { status: string }) {
  if (!isConnectionStatus(status)) return <Typography variant="body2" color="text.secondary">{status}</Typography>;

  const info = STATUS_MAP[status];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <StatusIcon status={status} />
      <Typography variant="body2" sx={{ fontWeight: 500, color: info.color }}>{info.label}</Typography>
    </Box>
  );
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ConnectionDetailDrawer({
  onClose,
  provider,
  status,
  lastSyncedAt,
  externalAccountName,
  syncScheduleLabel,
  onRefresh,
  onConnect,
}: ConnectionDetailDrawerProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const { selectedOrgId } = useAuth();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const isDisconnected = currentStatus === 'DISCONNECTED';

  const handleDisconnect = async () => {
    if (!selectedOrgId) return;
    setDisconnecting(true);
    try {
      const res = await api.integrations.disconnect({
        params: { orgId: selectedOrgId, provider },
        body: {},
      });
      if (res.status === 200) {
        toast.success(`${getProviderLabel(provider)} disconnected`);
        setCurrentStatus('DISCONNECTED');
        onRefresh();
      }
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrgId) return;
    setDeleting(true);
    try {
      const res = await api.integrations.deleteConnection({
        params: { orgId: selectedOrgId, provider },
        body: {},
      });
      if (res.status === 200) {
        toast.success(`${getProviderLabel(provider)} data deleted`);
        onRefresh();
        onClose();
      }
    } catch {
      toast.error('Failed to delete data');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleReconnect = () => {
    if (onConnect) {
      onConnect(provider);
    }
  };

  const sectionHeadingSx = {
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'text.secondary',
  } as const;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ p: 3, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: alpha(ct, 0.03),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ProviderIcon provider={provider} size={28} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontSize: '1.0625rem' }}>
              {getProviderLabel(provider)}
            </Typography>
            {externalAccountName && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                {externalAccountName}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Status row */}
        <Box sx={{ display: 'flex', gap: 4, mt: 2.5 }}>
          <Box>
            <Typography variant="caption" sx={{ ...sectionHeadingSx, mb: 0.5, display: 'block' }}>
              Status
            </Typography>
            <StatusIndicator status={currentStatus} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ ...sectionHeadingSx, mb: 0.5, display: 'block' }}>
              Last updated
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : 'Never'}
            </Typography>
            {syncScheduleLabel && (
              <Typography variant="caption" color="text.secondary">
                {syncScheduleLabel}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {isDisconnected ? (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This integration has been disconnected. Your synced data is still available for search.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {onConnect && (
                <Button
                  variant="outlined"
                  startIcon={<PlugsConnectedIcon size={15} weight="light" color="currentColor" />}
                  onClick={handleReconnect}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  Reconnect
                </Button>
              )}
              {!confirmDelete ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<TrashIcon size={15} weight="light" color="currentColor" />}
                  onClick={() => setConfirmDelete(true)}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  Delete Data
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDelete}
                  disabled={deleting}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {!confirmDisconnect ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<PlugsConnectedIcon size={15} weight="light" color="currentColor" />}
                onClick={() => setConfirmDisconnect(true)}
                size="small"
                sx={{ borderRadius: 1.5 }}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                onClick={handleDisconnect}
                disabled={disconnecting}
                size="small"
                sx={{ borderRadius: 1.5 }}
              >
                {disconnecting ? 'Disconnecting...' : 'Confirm'}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
