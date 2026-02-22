import type { DbId } from '@grabdy/common';
import {
  alpha,
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CheckCircleIcon,
  ClockIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';

import { useIndexingStatus } from './hooks/useIndexingStatus';

interface IndexingStatusCardProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
}

export function IndexingStatusCard({
  orgId,
  dataSourceId,
}: IndexingStatusCardProps) {
  const theme = useTheme();
  const { status, loading } = useIndexingStatus(orgId, dataSourceId);

  if (loading && !status) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!status) return null;

  const progress =
    status.totalFiles > 0
      ? Math.round((status.processedFiles / status.totalFiles) * 100)
      : 0;

  const statusConfig = {
    PROCESSING: {
      color: theme.palette.info.main,
      icon: <ClockIcon size={16} weight="light" color={theme.palette.info.main} />,
      label: 'Processing',
    },
    READY: {
      color: theme.palette.success.main,
      icon: <CheckCircleIcon size={16} weight="light" color={theme.palette.success.main} />,
      label: 'Ready',
    },
    FAILED: {
      color: theme.palette.error.main,
      icon: <WarningCircleIcon size={16} weight="light" color={theme.palette.error.main} />,
      label: 'Failed',
    },
  };

  const config = statusConfig[status.status];

  return (
    <Box
      sx={{
        border: 1,
        borderColor: alpha(config.color, 0.3),
        borderRadius: 1.5,
        p: 2,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {config.icon}
          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
            {status.repoFullName}
          </Typography>
        </Box>
        <Chip
          label={config.label}
          size="small"
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 600,
            color: config.color,
            bgcolor: alpha(config.color, 0.08),
            border: 'none',
          }}
        />
      </Box>

      {/* Progress */}
      {status.status === 'PROCESSING' && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
              '& .MuiLinearProgress-bar': { borderRadius: 3 },
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.5, display: 'block' }}
          >
            {status.processedFiles} / {status.totalFiles} files ({progress}%)
          </Typography>
        </Box>
      )}

      {status.status === 'READY' && (
        <Typography variant="caption" color="text.secondary">
          {status.totalFiles} files indexed
        </Typography>
      )}

      {/* Branch and commit info */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Branch: {status.branch}
        </Typography>
        {status.lastCommitSha && (
          <Typography variant="caption" color="text.secondary">
            Commit: {status.lastCommitSha.slice(0, 7)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
