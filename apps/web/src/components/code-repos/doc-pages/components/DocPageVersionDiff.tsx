import Markdown from 'react-markdown';

import type { DbId } from '@grabdy/common';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { diffLines } from 'diff';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import { usePageVersions } from '../hooks/usePageVersions';
import { docPageMarkdownStyles } from '../styles';

import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

interface DocPageVersionDiffProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  pageId: DbId<'DocPage'>;
  selectedVersionId: string;
}

export function DocPageVersionDiff({
  orgId,
  dataSourceId,
  pageId,
  selectedVersionId,
}: DocPageVersionDiffProps) {
  const theme = useTheme();
  const { versions } = usePageVersions(orgId, dataSourceId, pageId);

  const selectedVersion = versions?.find((v) => v.id === selectedVersionId);
  const isFirstVersion = selectedVersion?.version === 1;

  // Find the previous version ID for diff computation
  const previousVersionId = (() => {
    if (!versions || isFirstVersion) return null;
    const idx = versions.findIndex((v) => v.id === selectedVersionId);
    // versions are sorted newest first, so previous version is idx+1
    if (idx >= 0 && idx < versions.length - 1) return versions[idx + 1].id;
    return null;
  })();

  const { data: versionDetail, isLoading: loadingDetail } = useQuery({
    queryKey: [
      'code-repos',
      'doc-page-version-detail',
      orgId,
      dataSourceId,
      pageId,
      selectedVersionId,
    ],
    queryFn: async () => {
      const res = await api.codeRepos.getDocPageVersion({
        params: { orgId, dataSourceId, pageId, versionId: selectedVersionId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedVersionId,
  });

  const { data: previousVersionDetail, isLoading: loadingPrevious } = useQuery({
    queryKey: [
      'code-repos',
      'doc-page-version-detail',
      orgId,
      dataSourceId,
      pageId,
      previousVersionId,
    ],
    queryFn: async () => {
      if (!previousVersionId) return null;
      const res = await api.codeRepos.getDocPageVersion({
        params: { orgId, dataSourceId, pageId, versionId: previousVersionId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!previousVersionId,
  });

  const isLoading = loadingDetail || loadingPrevious;

  if (isLoading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!versionDetail) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Version not found.
        </Typography>
      </Box>
    );
  }

  if (isFirstVersion) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <Box sx={{ p: 2.5, ...docPageMarkdownStyles }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              display: 'block',
              mb: 1.5,
            }}
          >
            Initial version
          </Typography>
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { plainText: ['mermaid'] }], rehypeRaw]}
          >
            {versionDetail.content}
          </Markdown>
        </Box>
      </Box>
    );
  }

  const changes = diffLines(previousVersionDetail?.content ?? '', versionDetail.content);

  return (
    <Box sx={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
      <Box sx={{ p: 1.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            display: 'block',
            px: 0.5,
            mb: 1,
          }}
        >
          Changes from v{(selectedVersion?.version ?? 1) - 1} to v{selectedVersion?.version}
        </Typography>
        <Box
          sx={{
            fontFamily: FONT_MONO,
            fontSize: '0.78rem',
            lineHeight: 1.6,
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {changes.map((change, i) => {
            const lines = change.value.replace(/\n$/, '').split('\n');
            return lines.map((line, j) => (
              <Box
                key={`${i}-${j}`}
                sx={{
                  px: 1.5,
                  py: 0.125,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: change.added
                    ? alpha(theme.palette.success.main, 0.1)
                    : change.removed
                      ? alpha(theme.palette.error.main, 0.1)
                      : 'transparent',
                  color: change.added
                    ? 'success.dark'
                    : change.removed
                      ? 'error.dark'
                      : 'text.secondary',
                  borderLeft: '3px solid',
                  borderColor: change.added
                    ? 'success.main'
                    : change.removed
                      ? 'error.main'
                      : 'transparent',
                }}
              >
                <Box component="span" sx={{ userSelect: 'none', mr: 1, color: 'text.disabled' }}>
                  {change.added ? '+' : change.removed ? '-' : ' '}
                </Box>
                {line || '\u00A0'}
              </Box>
            ));
          })}
        </Box>
      </Box>
    </Box>
  );
}
