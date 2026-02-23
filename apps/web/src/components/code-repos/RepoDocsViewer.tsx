import Markdown from 'react-markdown';

import type { DbId } from '@grabdy/common';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { FileTextIcon } from '@phosphor-icons/react';
import remarkGfm from 'remark-gfm';

import { useRepoDocs } from './hooks/useRepoDocs';

interface RepoDocsViewerProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
}

export function RepoDocsViewer({ orgId, dataSourceId }: RepoDocsViewerProps) {
  const theme = useTheme();
  const { docs, loading } = useRepoDocs(orgId, dataSourceId);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!docs) {
    return (
      <Box sx={{ py: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <FileTextIcon size={18} weight="light" color={theme.palette.text.secondary} />
        <Typography variant="body2" color="text.secondary">
          No documentation generated yet. Documentation will be available after indexing completes.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          }}
        >
          Generated Documentation
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            v{docs.version}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {docs.commitSha.slice(0, 7)}
          </Typography>
        </Box>
      </Box>

      {/* Markdown content */}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          p: 2.5,
          bgcolor: alpha(theme.palette.text.primary, 0.01),
          '& h1': { typography: 'h5', mt: 0, mb: 1.5, color: 'text.primary' },
          '& h2': { typography: 'h6', mt: 2, mb: 1, color: 'text.primary' },
          '& h3': { typography: 'subtitle1', mt: 1.5, mb: 0.75, color: 'text.primary' },
          '& p': { typography: 'body2', mb: 1, color: 'text.secondary', lineHeight: 1.7 },
          '& ul, & ol': { pl: 2.5, mb: 1 },
          '& li': { typography: 'body2', color: 'text.secondary', mb: 0.25 },
          '& code': {
            fontFamily: 'monospace',
            fontSize: '0.85em',
            bgcolor: alpha(theme.palette.text.primary, 0.06),
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
          },
          '& pre': {
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            p: 1.5,
            borderRadius: 1,
            overflow: 'auto',
            mb: 1.5,
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& a': { color: 'primary.main' },
          '& blockquote': {
            borderLeft: 3,
            borderColor: 'divider',
            pl: 2,
            ml: 0,
            color: 'text.secondary',
          },
        }}
      >
        <Markdown remarkPlugins={[remarkGfm]}>{docs.content}</Markdown>
      </Box>
    </Box>
  );
}
