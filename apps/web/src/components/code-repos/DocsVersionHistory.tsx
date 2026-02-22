import type { DbId } from '@grabdy/common';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { ClockCounterClockwiseIcon, GitCommitIcon } from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';

import { useDocsHistory } from './hooks/useDocsHistory';

interface DocsVersionHistoryProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  onSelectVersion?: (versionId: string) => void;
}

export function DocsVersionHistory({
  orgId,
  dataSourceId,
  onSelectVersion,
}: DocsVersionHistoryProps) {
  const theme = useTheme();
  const { versions, loading } = useDocsHistory(orgId, dataSourceId);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (versions.length === 0) {
    return (
      <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ClockCounterClockwiseIcon
          size={18}
          weight="light"
          color={theme.palette.text.secondary}
        />
        <Typography variant="body2" color="text.secondary">
          No version history available yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'text.secondary',
        }}
      >
        Version History ({versions.length})
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {versions.map((version, idx) => (
          <Box
            key={version.id}
            role={onSelectVersion ? 'button' : undefined}
            tabIndex={onSelectVersion ? 0 : undefined}
            onClick={() => onSelectVersion?.(version.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSelectVersion) onSelectVersion(version.id);
            }}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              py: 1.5,
              px: 1.5,
              borderRadius: 1,
              cursor: onSelectVersion ? 'pointer' : 'default',
              '&:hover': onSelectVersion
                ? { bgcolor: alpha(theme.palette.text.primary, 0.04) }
                : {},
            }}
          >
            {/* Timeline dot and line */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pt: 0.25,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: idx === 0 ? 'primary.main' : 'grey.400',
                  flexShrink: 0,
                }}
              />
              {idx < versions.length - 1 && (
                <Box
                  sx={{
                    width: 1,
                    flex: 1,
                    minHeight: 20,
                    bgcolor: 'divider',
                    mt: 0.5,
                  }}
                />
              )}
            </Box>

            {/* Version info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: idx === 0 ? 600 : 400 }}>
                  Version {version.version}
                </Typography>
                {idx === 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'primary.main',
                      textTransform: 'uppercase',
                    }}
                  >
                    Latest
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 0.25,
                }}
              >
                <GitCommitIcon
                  size={12}
                  weight="light"
                  color={theme.palette.text.disabled}
                />
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                  {version.commitSha.slice(0, 7)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
