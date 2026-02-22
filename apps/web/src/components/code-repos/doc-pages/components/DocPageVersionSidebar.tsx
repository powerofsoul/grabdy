import { useCallback } from 'react';

import type { DbId } from '@grabdy/common';
import {
  alpha,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ClockIcon, XIcon } from '@phosphor-icons/react';
import { format } from 'date-fns';

import { usePageVersions } from '../hooks/usePageVersions';

interface DocPageVersionSidebarProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  pageId: DbId<'DocPage'>;
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
  onClose: () => void;
}

export function DocPageVersionSidebar({
  orgId,
  dataSourceId,
  pageId,
  selectedVersionId,
  onSelectVersion,
  onClose,
}: DocPageVersionSidebarProps) {
  const theme = useTheme();
  const { versions, loading } = usePageVersions(orgId, dataSourceId, pageId);

  const handleClick = useCallback(
    (versionId: string) => {
      onSelectVersion(selectedVersionId === versionId ? null : versionId);
    },
    [selectedVersionId, onSelectVersion],
  );

  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: 'divider',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: alpha(theme.palette.background.default, 0.5),
      }}
    >
      {/* Header with close button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            flex: 1,
          }}
        >
          Version History
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <XIcon size={16} weight="light" />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : !versions || versions.length === 0 ? (
        <Box sx={{ py: 2, px: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No version history available.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: 1, py: 1, overflow: 'auto', flex: 1 }}>
          {versions.map((version) => {
            const isSelected = selectedVersionId === version.id;
            return (
              <Box
                key={version.id}
                onClick={() => handleClick(version.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  '&:hover': {
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.text.primary, 0.04),
                  },
                }}
              >
                <ClockIcon size={14} weight="light" color={theme.palette.text.secondary} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      v{version.version}
                    </Typography>
                    <Chip
                      label={version.source}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        fontWeight: 600,
                        color:
                          version.source === 'AI'
                            ? 'info.main'
                            : 'warning.main',
                        bgcolor:
                          version.source === 'AI'
                            ? alpha(theme.palette.info.main, 0.08)
                            : alpha(theme.palette.warning.main, 0.08),
                        border: 'none',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      {format(new Date(version.createdAt), 'MMM d, yyyy HH:mm')}
                    </Typography>
                    {version.commitSha && (
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                        {version.commitSha.slice(0, 7)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
