import type { DbId } from '@grabdy/common';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

interface DiffLine {
  type: 'addition' | 'deletion' | 'unchanged';
  content: string;
  lineNumber: number | null;
}

interface DiffData {
  currentVersion: number;
  previousVersion: number | null;
  lines: DiffLine[];
}

interface DocsDiffViewerProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  versionId: string;
}

export function DocsDiffViewer({ orgId, dataSourceId, versionId }: DocsDiffViewerProps) {
  const theme = useTheme();

  const { data: diff, isLoading } = useQuery({
    queryKey: ['code-repos', 'diff', orgId, dataSourceId, versionId],
    queryFn: async (): Promise<DiffData | null> => {
      const res = await api.codeRepos.getDocsDiff({
        params: { orgId, dataSourceId, versionId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return null;
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!diff) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No diff data available.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {diff.previousVersion !== null
            ? `v${diff.previousVersion} to v${diff.currentVersion}`
            : `v${diff.currentVersion} (initial)`}
        </Typography>
      </Box>

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          overflow: 'auto',
          maxHeight: 500,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {diff.lines.map((line, idx) => {
          const bgColor =
            line.type === 'addition'
              ? alpha(theme.palette.success.main, 0.1)
              : line.type === 'deletion'
                ? alpha(theme.palette.error.main, 0.1)
                : 'transparent';

          const borderLeftColor =
            line.type === 'addition'
              ? theme.palette.success.main
              : line.type === 'deletion'
                ? theme.palette.error.main
                : 'transparent';

          const prefix =
            line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';

          return (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                bgcolor: bgColor,
                borderLeft: `3px solid ${borderLeftColor}`,
                px: 1,
                py: 0.25,
                minHeight: 20,
                '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  width: 40,
                  textAlign: 'right',
                  pr: 1,
                  color: 'text.disabled',
                  userSelect: 'none',
                  flexShrink: 0,
                  fontSize: 12,
                  lineHeight: '20px',
                }}
              >
                {line.lineNumber ?? ''}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  color: 'text.disabled',
                  width: 16,
                  flexShrink: 0,
                  userSelect: 'none',
                  fontSize: 12,
                  lineHeight: '20px',
                }}
              >
                {prefix}
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontFamily: 'monospace',
                  whiteSpace: 'pre',
                  color:
                    line.type === 'unchanged' ? 'text.secondary' : 'text.primary',
                  fontSize: 12,
                  lineHeight: '20px',
                }}
              >
                {line.content}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
