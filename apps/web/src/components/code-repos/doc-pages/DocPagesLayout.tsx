import { useCallback, useMemo, useState } from 'react';

import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, Typography } from '@mui/material';
import { FileTextIcon } from '@phosphor-icons/react';

import { DocPageContent } from './components/DocPageContent';
import { DocPageSidebar } from './components/DocPageSidebar';
import { DocPageVersionDiff } from './components/DocPageVersionDiff';
import { DocPageVersionSidebar } from './components/DocPageVersionSidebar';
import { useDocPages } from './hooks/useDocPages';

interface DocPagesLayoutProps {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  repoName: string;
}

function getDefaultPageId(
  pages:
    | ReadonlyArray<{ id: DbId<'DocPage'>; parentId: string | null; sortOrder: number }>
    | null
    | undefined
): DbId<'DocPage'> | undefined {
  if (!pages || pages.length === 0) return undefined;
  const roots = pages.filter((p) => p.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  return roots.length > 0 ? roots[0].id : pages[0].id;
}

export function DocPagesLayout({ orgId, dataSourceId, repoName }: DocPagesLayoutProps) {
  const { pages, loading } = useDocPages(orgId, dataSourceId);
  const defaultPageId = useMemo(() => getDefaultPageId(pages), [pages]);
  const [selectedPageId, setSelectedPageId] = useState<DbId<'DocPage'> | undefined>(undefined);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const effectivePageId = selectedPageId ?? defaultPageId;

  const handleSelectPage = useCallback((pageId: DbId<'DocPage'>) => {
    setSelectedPageId(pageId);
    setSelectedVersionId(null);
  }, []);

  const handleToggleVersions = useCallback(() => {
    setShowVersions((prev) => {
      if (!prev) setSelectedVersionId(null);
      return !prev;
    });
  }, []);

  const handleCloseVersions = useCallback(() => {
    setShowVersions(false);
    setSelectedVersionId(null);
  }, []);

  const handleSelectVersion = useCallback((versionId: string | null) => {
    setSelectedVersionId(versionId);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <Box sx={{ py: 3, px: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <FileTextIcon size={18} weight="light" color="currentColor" />
        <Typography variant="body2" color="text.secondary">
          No documentation pages generated yet. Pages will be available after indexing completes.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <DocPageSidebar
        pages={pages}
        selectedPageId={effectivePageId}
        onSelectPage={handleSelectPage}
        repoName={repoName}
      />

      {/* Middle area: either diff or normal content */}
      {selectedVersionId && effectivePageId ? (
        <DocPageVersionDiff
          orgId={orgId}
          dataSourceId={dataSourceId}
          pageId={effectivePageId}
          selectedVersionId={selectedVersionId}
        />
      ) : (
        <DocPageContent
          key={effectivePageId}
          orgId={orgId}
          dataSourceId={dataSourceId}
          pageId={effectivePageId}
          showVersions={showVersions}
          onToggleVersions={handleToggleVersions}
        />
      )}

      {/* Version sidebar on the right */}
      {showVersions && effectivePageId && (
        <DocPageVersionSidebar
          orgId={orgId}
          dataSourceId={dataSourceId}
          pageId={effectivePageId}
          selectedVersionId={selectedVersionId}
          onSelectVersion={handleSelectVersion}
          onClose={handleCloseVersions}
        />
      )}
    </Box>
  );
}
