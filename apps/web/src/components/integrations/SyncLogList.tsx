import { alpha, Box, CircularProgress, Tooltip, Typography, useTheme } from '@mui/material';
import { Check, Clock, Lightning, Plugs, User, Warning } from '@phosphor-icons/react';

interface SyncLogEntry {
  id: string;
  status: string;
  trigger: string;
  itemsSynced: number;
  itemsFailed: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface SyncLogListProps {
  logs: SyncLogEntry[];
}

function StatusIcon({ status }: { status: string }) {
  const theme = useTheme();
  switch (status) {
    case 'COMPLETED':
      return <Check size={13} color={theme.palette.success.main} weight="light" />;
    case 'FAILED':
      return <Warning size={13} color={theme.palette.error.main} weight="light" />;
    case 'RUNNING':
      return <CircularProgress size={12} thickness={5} />;
    case 'PENDING':
      return <Clock size={13} color={theme.palette.info.main} weight="light" />;
    default:
      return null;
  }
}

function TriggerIcon({ trigger }: { trigger: string }) {
  const size = 11;
  switch (trigger) {
    case 'MANUAL': return <User size={size} weight="light" color="currentColor" />;
    case 'WEBHOOK': return <Plugs size={size} weight="light" color="currentColor" />;
    default: return <Lightning size={size} weight="light" color="currentColor" />;
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function duration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function SyncLogList({ logs }: SyncLogListProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  if (logs.length === 0) {
    return (
      <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Clock size={20} weight="light" color="currentColor" style={{ opacity: 0.25 }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          No sync history yet
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {logs.map((log) => {
        const dur = duration(log.startedAt, log.completedAt);

        return (
          <Box
            key={log.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
              px: 1.5,
              borderRadius: 1.5,
              '&:hover': { bgcolor: alpha(ct, 0.02) },
            }}
          >
            {/* Status */}
            <Box sx={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <StatusIcon status={log.status} />
            </Box>

            {/* Trigger + details */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ color: 'text.secondary', display: 'inline-flex' }}>
                  <TriggerIcon trigger={log.trigger} />
                </Box>
                <Typography variant="body2" sx={{ fontSize: 13 }} noWrap>
                  {log.status === 'RUNNING' && 'In progress...'}
                  {log.status === 'PENDING' && 'Queued'}
                  {log.status === 'COMPLETED' && (
                    log.itemsSynced > 0 ? `${log.itemsSynced} synced` : 'No changes'
                  )}
                  {log.status === 'FAILED' && (
                    <Typography component="span" sx={{ fontSize: 13, color: 'error.main' }}>
                      Failed{log.itemsFailed > 0 ? ` (${log.itemsFailed})` : ''}
                    </Typography>
                  )}
                </Typography>
              </Box>
              {log.errorMessage && (
                <Typography variant="caption" sx={{ color: 'error.main', fontSize: 11 }} noWrap>
                  {log.errorMessage}
                </Typography>
              )}
            </Box>

            {/* Right: duration + time */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              {dur && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {dur}
                </Typography>
              )}
              <Tooltip title={new Date(log.createdAt).toLocaleString()} placement="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, cursor: 'default' }}>
                  {relativeTime(log.createdAt)}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
