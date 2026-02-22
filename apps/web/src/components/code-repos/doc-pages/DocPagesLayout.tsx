import { useCallback, useEffect, useState } from 'react';

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

export function DocPagesLayout({ orgId, dataSourceId, repoName }: DocPagesLayoutProps) {
  const { pages, loading } = useDocPages(orgId, dataSourceId);
  const [selectedPageId, setSelectedPageId] = useState<DbId<'DocPage'> | undefined>(undefined);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Auto-select first page when pages load
  useEffect(() => {
    if (pages && pages.length > 0 && !selectedPageId) {
      const roots = pages
        .filter((p) => p.parentId === null)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (roots.length > 0) {
        setSelectedPageId(roots[0].id);
      } else {
        setSelectedPageId(pages[0].id);
      }
    }
  }, [pages, selectedPageId]);

  // Reset version state when page changes
  useEffect(() => {
    setSelectedVersionId(null);
  }, [selectedPageId]);

  const handleSelectPage = useCallback((pageId: DbId<'DocPage'>) => {
    setSelectedPageId(pageId);
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
        selectedPageId={selectedPageId}
        onSelectPage={handleSelectPage}
        repoName={repoName}
      />

      {/* Middle area: either diff or normal content */}
      {selectedVersionId && selectedPageId ? (
        <DocPageVersionDiff
          orgId={orgId}
          dataSourceId={dataSourceId}
          pageId={selectedPageId}
          selectedVersionId={selectedVersionId}
        />
      ) : (
        <DocPageContent
          orgId={orgId}
          dataSourceId={dataSourceId}
          pageId={selectedPageId}
          showVersions={showVersions}
          onToggleVersions={handleToggleVersions}
        />
      )}

      {/* Version sidebar on the right */}
      {showVersions && selectedPageId && (
        <DocPageVersionSidebar
          orgId={orgId}
          dataSourceId={dataSourceId}
          pageId={selectedPageId}
          selectedVersionId={selectedVersionId}
          onSelectVersion={handleSelectVersion}
          onClose={handleCloseVersions}
        />
      )}
    </Box>
  );
}
