import { type DataSourceStatus } from '@grabdy/contracts';
import { alpha, Box, Chip, keyframes, LinearProgress, useTheme } from '@mui/material';

const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

interface StatusChipProps {
  status: DataSourceStatus;
  progress?: number;
}

export function StatusChip({ status, progress }: StatusChipProps) {
  const theme = useTheme();
  const isProcessing = status === 'PROCESSING';

  const configMap: Record<DataSourceStatus, { label: string; color: string; bgColor: string }> = {
    UPLOADED: {
      label: 'Uploaded',
      color: theme.palette.text.secondary,
      bgColor: theme.palette.action.hover,
    },
    PROCESSING: {
      label: 'Processing',
      color: theme.palette.text.secondary,
      bgColor: theme.palette.action.hover,
    },
    READY: {
      label: 'Ready',
      color: theme.palette.success.dark,
      bgColor: alpha(theme.palette.success.main, 0.1),
    },
    FAILED: {
      label: 'Failed',
      color: theme.palette.error.dark,
      bgColor: alpha(theme.palette.error.main, 0.1),
    },
  };

  const config = configMap[status];

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: 0.5, minWidth: 80 }}>
      <Chip
        label={config.label}
        size="small"
        sx={{
          color: config.color,
          bgcolor: config.bgColor,
          border: 'none',
          fontWeight: 500,
          fontSize: '0.75rem',
          ...(isProcessing && {
            animation: `${pulse} 1.5s ease-in-out infinite`,
          }),
        }}
      />
      {isProcessing && progress != null && progress > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3,
            borderRadius: 1,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              bgcolor: 'primary.main',
            },
          }}
        />
      )}
    </Box>
  );
}
