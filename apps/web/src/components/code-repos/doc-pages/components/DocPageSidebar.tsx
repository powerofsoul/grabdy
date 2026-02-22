import { useMemo } from 'react';

import type { DbId } from '@grabdy/common';
import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';

import { DocPageTreeItem } from './DocPageTreeItem';

interface PageSummary {
  id: DbId<'DocPage'>;
  parentId: DbId<'DocPage'> | null;
  title: string;
  slug: string;
  sortOrder: number;
  isUserEdited: boolean;
  version: number;
}

interface DocPageSidebarProps {
  pages: PageSummary[];
  selectedPageId: DbId<'DocPage'> | undefined;
  onSelectPage: (pageId: DbId<'DocPage'>) => void;
  repoName: string;
}

export function DocPageSidebar({
  pages,
  selectedPageId,
  onSelectPage,
  repoName,
}: DocPageSidebarProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const { rootPages, childrenMap } = useMemo(() => {
    const map = new Map<string, PageSummary[]>();
    const roots: PageSummary[] = [];

    for (const page of pages) {
      if (page.parentId === null) {
        roots.push(page);
      } else {
        const existing = map.get(page.parentId) ?? [];
        existing.push(page);
        map.set(page.parentId, existing);
      }
    }

    // Sort by sortOrder
    roots.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const [key, children] of map) {
      children.sort((a, b) => a.sortOrder - b.sortOrder);
      map.set(key, children);
    }

    return { rootPages: roots, childrenMap: map };
  }, [pages]);

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        overflow: 'auto',
        bgcolor: alpha(theme.palette.background.default, 0.5),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Repo header with back navigation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Tooltip title="Back to repositories">
          <IconButton
            size="small"
            onClick={() => navigate({ to: '/dashboard/code-repos' })}
            sx={{ color: 'text.secondary', flexShrink: 0 }}
          >
            <ArrowLeftIcon size={16} weight="light" />
          </IconButton>
        </Tooltip>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            fontSize: '0.82rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
          title={repoName}
        >
          {repoName}
        </Typography>
      </Box>

      <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
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
          Pages ({pages.length})
        </Typography>
      </Box>

      <Box sx={{ px: 0.5, pb: 1, overflow: 'auto', flex: 1, minHeight: 0 }}>
        {rootPages.map((page) => (
          <DocPageTreeItem
            key={page.id}
            page={page}
            children={childrenMap.get(page.id) ?? []}
            childrenMap={childrenMap}
            selectedPageId={selectedPageId}
            onSelectPage={onSelectPage}
            depth={0}
          />
        ))}
      </Box>
    </Box>
  );
}
