import type { IntegrationProvider } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CaretRightIcon, CheckIcon, PauseIcon,WarningCircleIcon } from '@phosphor-icons/react';

import type { ConnectionSummary } from './IntegrationGrid';
import { getProviderDescription, getProviderDetails, getProviderLabel, ProviderIcon } from './ProviderIcon';

interface IntegrationCardProps {
  provider: IntegrationProvider;
  connection: ConnectionSummary | null;
  onConnect?: (provider: IntegrationProvider) => void;
  onManage: (provider: IntegrationProvider, connection: ConnectionSummary) => void;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function IntegrationCard({ provider, connection, onManage }: IntegrationCardProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const hasConnection = connection && connection.status !== 'REVOKED';
  const isActive = connection?.status === 'ACTIVE';
  const isError = connection?.status === 'ERROR';

  if (hasConnection) {
    return (
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onManage(provider, connection)}
        onKeyDown={(e) => { if (e.key === 'Enter') onManage(provider, connection); }}
        sx={{
          border: '1px solid',
          borderColor: isError
            ? alpha(theme.palette.error.main, 0.4)
            : alpha(ct, 0.12),
          borderLeft: `3px solid ${
            isError
              ? theme.palette.error.main
              : isActive
                ? theme.palette.success.main
                : theme.palette.warning.main
          }`,

          p: 2.5,
          minHeight: 164,
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 180ms ease',
          cursor: 'pointer',
          '&:hover': {
            borderColor: alpha(ct, 0.3),
          },
          '&:focus-visible': {
            outline: `2px solid ${ct}`,
            outlineOffset: 2,
          },
        }}
      >
        {/* Top row: Icon + Status */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <ProviderIcon provider={provider} size={24} />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {isActive && <CheckIcon size={12} weight="light" color={theme.palette.success.main} />}
            {isError && <WarningCircleIcon size={12} weight="light" color={theme.palette.error.main} />}
            {connection.status === 'PAUSED' && <PauseIcon size={12} weight="light" color={theme.palette.warning.main} />}
            <Typography
              variant="caption"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1,
                color: isError
                  ? 'error.main'
                  : isActive
                    ? 'success.main'
                    : 'warning.main',
              }}
            >
              {isActive ? 'Connected' : isError ? 'Error' : 'Paused'}
            </Typography>
          </Box>
        </Box>

        {/* Middle: Name + account name */}
        <Typography variant="subtitle1">
          {getProviderLabel(provider)}
        </Typography>
        {connection.externalAccountName && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.4 }}>
            {connection.externalAccountName}
          </Typography>
        )}

        {/* Bottom row: Sync time + chevron */}
        <Box sx={{ mt: 'auto', pt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            {connection.lastSyncedAt
              ? `Synced ${relativeTime(connection.lastSyncedAt)}`
              : 'Not synced yet'}
          </Typography>
          <CaretRightIcon size={16} weight="light" color={theme.palette.text.disabled} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        p: 2.5,
        minHeight: 164,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Icon */}
      <Box sx={{ mb: 1.5 }}>
        <ProviderIcon provider={provider} size={24} />
      </Box>

      {/* Name + description + details */}
      <Typography variant="subtitle1">
        {getProviderLabel(provider)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.4 }}>
        {getProviderDescription(provider)}
      </Typography>
      <Typography variant="caption" sx={{ mt: 0.5, lineHeight: 1.4, fontSize: 12, color: 'text.secondary' }}>
        {getProviderDetails(provider)}
      </Typography>

      {/* Coming soon */}
      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Typography variant="caption" sx={{ fontSize: 12, fontStyle: 'italic', color: 'text.disabled' }}>
          Coming soon
        </Typography>
      </Box>
    </Box>
  );
}
