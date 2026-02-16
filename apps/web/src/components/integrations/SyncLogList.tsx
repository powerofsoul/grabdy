import { alpha, Box, Tooltip, Typography, useTheme } from '@mui/material';
import { ClockIcon } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';

import { duration } from './helpers';
import { StatusIcon } from './StatusIcon';
import { TriggerIcon } from './TriggerIcon';
import type { SyncLogEntry } from './types';

interface SyncLogListProps {
  logs: SyncLogEntry[];
}

export function SyncLogList({ logs }: SyncLogListProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  if (logs.length === 0) {
    return (
      <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <ClockIcon size={20} weight="light" color="currentColor" style={{ opacity: 0.25 }} />
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
            <Box
              sx={{
                width: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
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
                  {log.status === 'COMPLETED' &&
                    (log.itemsSynced > 0 ? `${log.itemsSynced} synced` : 'No changes')}
                  {log.status === 'FAILED' && (
                    <Typography component="span" sx={{ fontSize: 13, color: 'error.main' }}>
                      Failed{log.itemsFailed > 0 ? ` (${log.itemsFailed})` : ''}
                    </Typography>
                  )}
                </Typography>
              </Box>
              {log.status === 'COMPLETED' &&
                Array.isArray(log.details?.items) &&
                log.details.items.length > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontSize: 11, lineHeight: 1.4 }}
                  >
                    {log.details.items.length <= 3
                      ? log.details.items.join(', ')
                      : `${log.details.items.slice(0, 3).join(', ')} +${log.details.items.length - 3} more`}
                  </Typography>
                )}
              {log.status === 'FAILED' && log.errorMessage && (
                <Typography variant="caption" sx={{ color: 'error.main', fontSize: 11 }} noWrap>
                  Unable to sync — please reconnect
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: 11, cursor: 'default' }}
                >
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
