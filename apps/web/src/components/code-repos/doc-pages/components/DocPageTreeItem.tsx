import { useCallback, useState } from 'react';

import type { DbId } from '@grabdy/common';
import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';
import { CaretDownIcon, CaretRightIcon, FileTextIcon } from '@phosphor-icons/react';

interface PageNode {
  id: DbId<'DocPage'>;
  parentId: DbId<'DocPage'> | null;
  title: string;
  slug: string;
  sortOrder: number;
  isUserEdited: boolean;
  version: number;
}

interface DocPageTreeItemProps {
  page: PageNode;
  children: PageNode[];
  childrenMap: Map<string, PageNode[]>;
  selectedPageId: DbId<'DocPage'> | undefined;
  onSelectPage: (pageId: DbId<'DocPage'>) => void;
  depth: number;
}

export function DocPageTreeItem({
  page,
  children,
  childrenMap,
  selectedPageId,
  onSelectPage,
  depth,
}: DocPageTreeItemProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const isSelected = selectedPageId === page.id;

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleSelect = useCallback(() => {
    onSelectPage(page.id);
  }, [onSelectPage, page.id]);

  return (
    <Box>
      <Box
        onClick={handleSelect}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: 1 + depth * 1.5,
          pr: 1,
          py: 0.75,
          cursor: 'pointer',
          borderRadius: 1,
          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          '&:hover': {
            bgcolor: isSelected
              ? alpha(theme.palette.primary.main, 0.12)
              : alpha(theme.palette.text.primary, 0.04),
          },
        }}
      >
        {hasChildren ? (
          <Box
            onClick={handleToggle}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              p: 0.25,
              borderRadius: 0.5,
              '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.08) },
            }}
          >
            {expanded ? (
              <CaretDownIcon size={14} weight="light" color={theme.palette.text.secondary} />
            ) : (
              <CaretRightIcon size={14} weight="light" color={theme.palette.text.secondary} />
            )}
          </Box>
        ) : (
          <Box sx={{ width: 22 }}>
            <FileTextIcon size={14} weight="light" color={theme.palette.text.disabled} />
          </Box>
        )}

        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontSize: 13,
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? 'primary.main' : 'text.primary',
            minWidth: 0,
          }}
          noWrap
        >
          {page.title}
        </Typography>

        {page.isUserEdited && (
          <Chip
            label="Edited"
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 600,
              color: 'warning.main',
              bgcolor: alpha(theme.palette.warning.main, 0.08),
              border: 'none',
            }}
          />
        )}
      </Box>

      {hasChildren && expanded && (
        <Box>
          {children.map((child) => (
            <DocPageTreeItem
              key={child.id}
              page={child}
              children={childrenMap.get(child.id) ?? []}
              childrenMap={childrenMap}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              depth={depth + 1}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
