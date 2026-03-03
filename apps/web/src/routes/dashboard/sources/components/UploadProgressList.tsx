import { alpha, Box, IconButton, LinearProgress, Typography, useTheme } from '@mui/material';
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';

import type { FileUploadEntry } from '../hooks';

interface UploadProgressListProps {
  uploads: FileUploadEntry[];
  onDismiss: () => void;
}

export function UploadProgressList({ uploads, onDismiss }: UploadProgressListProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  if (uploads.length === 0) return null;

  const allDone = uploads.every((e) => e.status !== 'uploading');
  const doneCount = uploads.filter((e) => e.status === 'done').length;
  const errorCount = uploads.filter((e) => e.status === 'error').length;
  const uploadingCount = uploads.filter((e) => e.status === 'uploading').length;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        mb: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: alpha(ct, 0.02),
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
          {allDone
            ? `${doneCount} uploaded${errorCount > 0 ? `, ${errorCount} failed` : ''}`
            : `Uploading ${uploadingCount} of ${uploads.length} files`}
        </Typography>
        {allDone && (
          <IconButton size="small" onClick={onDismiss} sx={{ p: 0.25 }}>
            <XIcon size={14} weight="bold" color="currentColor" />
          </IconButton>
        )}
      </Box>

      <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
        {uploads.map((entry) => (
          <Box
            key={entry.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 0.75,
              '&:not(:last-child)': {
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
            }}
          >
            {entry.status === 'done' && (
              <CheckCircleIcon
                size={16}
                weight="fill"
                color={theme.palette.success.main}
                style={{ flexShrink: 0 }}
              />
            )}
            {entry.status === 'error' && (
              <WarningCircleIcon
                size={16}
                weight="fill"
                color={theme.palette.error.main}
                style={{ flexShrink: 0 }}
              />
            )}
            {entry.status === 'uploading' && <Box sx={{ width: 16, flexShrink: 0 }} />}

            <Typography
              noWrap
              sx={{
                fontSize: 13,
                flex: 1,
                minWidth: 0,
                color: entry.status === 'error' ? 'error.main' : 'text.primary',
              }}
            >
              {entry.fileName}
            </Typography>

            {entry.status === 'uploading' && (
              <Box sx={{ width: 100, flexShrink: 0 }}>
                <LinearProgress variant="determinate" value={entry.progress} sx={{ height: 4 }} />
              </Box>
            )}

            <Typography
              sx={{
                fontSize: 11,
                color: 'text.secondary',
                flexShrink: 0,
                minWidth: 32,
                textAlign: 'right',
              }}
            >
              {entry.status === 'uploading' && `${entry.progress}%`}
              {entry.status === 'done' && 'Done'}
              {entry.status === 'error' && 'Failed'}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
