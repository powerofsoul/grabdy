import type { ConnectionStatus } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import {
  CheckIcon,
  PauseIcon,
  PlugsConnectedIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';

import { STATUS_CONFIG } from './constants';
import { isConnectionStatus } from './helpers';

export function StatusChip({ status }: { status: string }) {
  const theme = useTheme();

  if (!isConnectionStatus(status)) {
    return (
      <Typography variant="body2" color="text.secondary">
        {status}
      </Typography>
    );
  }

  const info = STATUS_CONFIG[status];
  const iconProps = { size: 13, weight: 'light' } as const;
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

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: alpha(color, 0.08),
      }}
    >
      {icons[status]}
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11, color: info.color }}>
        {info.label}
      </Typography>
    </Box>
  );
}
