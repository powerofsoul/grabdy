import { useCallback, useEffect, useState } from 'react';

import type { ConnectionStatus, IntegrationProvider } from '@grabdy/contracts';
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Select,
  Switch,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  PauseIcon,
  PlugsConnectedIcon,
  TrashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

import { getProviderLabel, ProviderIcon } from './ProviderIcon';
import { SyncLogList } from './SyncLogList';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface SyncLog {
  id: string;
  connectionId: string;
  status: string;
  trigger: string;
  itemsSynced: number;
  itemsFailed: number;
  errorMessage: string | null;
  details: { items: string[] } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ConnectionDetailDrawerProps extends DrawerProps {
  provider: IntegrationProvider;
  status: string;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  externalAccountName: string | null;
  onRefresh: () => void;
  onConnect?: (provider: IntegrationProvider) => void;
}

const INTERVAL_OPTIONS = [
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Hourly' },
  { value: 360, label: 'Every 6 hours' },
  { value: 1440, label: 'Daily' },
] as const satisfies readonly { value: number; label: string }[];

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

export function ConnectionDetailDrawer({
  onClose,
  provider,
  status,
  lastSyncedAt,
  syncEnabled: initialSyncEnabled,
  syncIntervalMinutes: initialInterval,
  externalAccountName,
  onRefresh,
  onConnect,
}: ConnectionDetailDrawerProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const { selectedOrgId } = useAuth();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(initialSyncEnabled);
  const [interval, setInterval] = useState(initialInterval);
  const [currentStatus, setCurrentStatus] = useState(status);

  const isDisconnected = currentStatus === 'DISCONNECTED';
  const isSyncing = syncLogs.length > 0 && (syncLogs[0].status === 'PENDING' || syncLogs[0].status === 'RUNNING');

  const fetchLogs = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.integrations.listSyncLogs({
        params: { orgId: selectedOrgId, provider },
      });
      if (res.status === 200) {
        setSyncLogs(res.body.data);
      }
    } catch {
      // Silently fail — non-critical
    }
  }, [selectedOrgId, provider]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh logs while syncing
  useEffect(() => {
    if (!isSyncing) return;
    const timer = window.setInterval(fetchLogs, 3000);
    return () => window.clearInterval(timer);
  }, [isSyncing, fetchLogs]);

  const handleSync = async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.integrations.triggerSync({
        params: { orgId: selectedOrgId, provider },
        body: {},
      });
      if (res.status === 200) {
        if (res.body.alreadySyncing) {
          toast.info('Sync already in progress');
        } else {
          toast.success('Sync started');
        }
        fetchLogs();
      }
    } catch {
      toast.error('Failed to trigger sync');
    }
  };

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

  const handleConfigChange = async (updates: { syncEnabled?: boolean; syncIntervalMinutes?: number }) => {
    if (!selectedOrgId) return;
    try {
      await api.integrations.updateConfig({
        params: { orgId: selectedOrgId, provider },
        body: updates,
      });
    } catch {
      toast.error('Failed to update settings');
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
              Last synced
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {isDisconnected ? (
          <>
            {/* Disconnected state */}
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

            <Divider />

            {/* Sync history (still visible when disconnected) */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={sectionHeadingSx}>
                  Sync History
                </Typography>
                {syncLogs.length > 0 && (
                  <Chip label={`${syncLogs.length}`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, minWidth: 0 }} />
                )}
              </Box>
              <SyncLogList logs={syncLogs} />
            </Box>
          </>
        ) : (
          <>
            {/* Sync settings */}
            <Box>
              <Typography variant="caption" sx={{ ...sectionHeadingSx, mb: 1.5, display: 'block' }}>
                Sync Settings
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Auto-sync</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Keep data up to date automatically
                    </Typography>
                  </Box>
                  <Switch
                    checked={syncEnabled}
                    onChange={(e) => {
                      setSyncEnabled(e.target.checked);
                      handleConfigChange({ syncEnabled: e.target.checked });
                    }}
                    size="small"
                  />
                </Box>

                {syncEnabled && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.75 }}>Frequency</Typography>
                    <Select
                      value={interval}
                      size="small"
                      fullWidth
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setInterval(val);
                        handleConfigChange({ syncIntervalMinutes: val });
                      }}
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="outlined"
                startIcon={isSyncing ? <CircularProgress size={14} thickness={5} /> : <ArrowsClockwiseIcon size={15} weight="light" color="currentColor" />}
                onClick={handleSync}
                disabled={isSyncing}
                size="small"
                sx={{ flex: 1, borderRadius: 1.5 }}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
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

            <Divider />

            {/* Sync history */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={sectionHeadingSx}>
                  Sync History
                </Typography>
                {syncLogs.length > 0 && (
                  <Chip label={`${syncLogs.length}`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, minWidth: 0 }} />
                )}
              </Box>
              <SyncLogList logs={syncLogs} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
