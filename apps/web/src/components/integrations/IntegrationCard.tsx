import type { IntegrationProvider } from '@grabdy/contracts';
import { formatDistanceToNow } from 'date-fns';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CaretRightIcon, CheckIcon, PauseIcon, PlugsConnectedIcon, WarningCircleIcon } from '@phosphor-icons/react';

import type { ConnectionSummary } from './IntegrationGrid';
import type { ProviderKey } from './ProviderIcon';
import { getProviderDescription, getProviderDetails, getProviderLabel, ProviderIcon } from './ProviderIcon';

interface IntegrationCardProps {
  provider: ProviderKey;
  connection: ConnectionSummary | null;
  onConnect?: (provider: ProviderKey) => void;
  onManage?: (provider: IntegrationProvider, connection: ConnectionSummary) => void;
}

export function IntegrationCard({ provider, connection, onConnect, onManage }: IntegrationCardProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const isDisconnected = connection?.status === 'DISCONNECTED';
  const hasConnection = connection && !isDisconnected;
  const isActive = connection?.status === 'ACTIVE';
  const isError = connection?.status === 'ERROR';

  if (isDisconnected && connection) {
    return (
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onManage?.(connection.provider, connection)}
        onKeyDown={(e) => { if (e.key === 'Enter') onManage?.(connection.provider, connection); }}
        sx={{
          border: '1px solid',
          borderColor: alpha(ct, 0.12),
          borderLeft: `3px solid ${theme.palette.text.disabled}`,
          p: 2.5,
          minHeight: 164,
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 180ms ease',
          cursor: 'pointer',
          opacity: 0.75,
          '&:hover': { borderColor: alpha(ct, 0.3), opacity: 1 },
          '&:focus-visible': { outline: `2px solid ${ct}`, outlineOffset: 2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <ProviderIcon provider={provider} size={24} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlugsConnectedIcon size={12} weight="light" color={theme.palette.text.disabled} />
            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1, color: 'text.disabled' }}>
              Disconnected
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle1">{getProviderLabel(provider)}</Typography>
        {connection.externalAccountName && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.4 }}>
            {connection.externalAccountName}
          </Typography>
        )}

        <Box sx={{ mt: 'auto', pt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            Data still available
          </Typography>
          <CaretRightIcon size={16} weight="light" color={theme.palette.text.disabled} />
        </Box>
      </Box>
    );
  }

  if (hasConnection) {
    return (
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onManage?.(connection.provider, connection)}
        onKeyDown={(e) => { if (e.key === 'Enter') onManage?.(connection.provider, connection); }}
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
              ? `Synced ${formatDistanceToNow(new Date(connection.lastSyncedAt), { addSuffix: true })}`
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

      {/* Connect action */}
      <Box sx={{ mt: 'auto', pt: 2 }}>
        {onConnect ? (
          <Typography
            component="span"
            role="button"
            tabIndex={0}
            onClick={() => onConnect(provider)}
            onKeyDown={(e) => { if (e.key === 'Enter') onConnect(provider); }}
            variant="caption"
            sx={{
              fontSize: 12,
              fontWeight: 600,
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Connect
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ fontSize: 12, fontStyle: 'italic', color: 'text.disabled' }}>
            Coming soon
          </Typography>
        )}
      </Box>
    </Box>
  );
}
