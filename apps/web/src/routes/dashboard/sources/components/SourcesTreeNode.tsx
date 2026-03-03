import { useState } from 'react';

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CaretDownIcon, CaretRightIcon, FolderIcon } from '@phosphor-icons/react';
import { Link, useLocation } from '@tanstack/react-router';

import type { TreeNode } from '@/components/ui/Sidebar/helpers';

interface FolderItem {
  id: string;
  name: string;
  sourceCount: number;
  parentId: string | null;
}

export function SourcesTreeNode({ node, depth }: { node: TreeNode<FolderItem>; depth: number }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const location = useLocation();
  const to = '/dashboard/sources/$collectionId' as const;
  const isActive = location.pathname === `/dashboard/sources/${node.id}`;
  const hasChildren = node.children.length > 0;

  const [expanded, setExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <>
      <Link
        to={to}
        params={{ collectionId: node.id }}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 30,
            pl: 1.5 + depth * 1.25,
            pr: 1.5,
            cursor: 'pointer',
            bgcolor: isActive ? alpha(ct, 0.06) : 'transparent',
            '&:hover': { bgcolor: alpha(ct, isActive ? 0.08 : 0.03) },
          }}
        >
          {hasChildren ? (
            <Box
              onClick={toggleExpand}
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: alpha(ct, 0.4),
                cursor: 'pointer',
                p: 0.25,
              }}
            >
              {expanded ? (
                <CaretDownIcon size={9} weight="bold" color="currentColor" />
              ) : (
                <CaretRightIcon size={9} weight="bold" color="currentColor" />
              )}
            </Box>
          ) : (
            <Box sx={{ width: 13 }} />
          )}
          <FolderIcon
            size={14}
            weight="light"
            color="currentColor"
            style={{ color: isActive ? undefined : alpha(ct, 0.5) }}
          />
          <Typography
            noWrap
            sx={{
              flex: 1,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'text.primary' : 'text.secondary',
              lineHeight: 1.4,
            }}
          >
            {node.name}
          </Typography>
          {node.sourceCount > 0 && (
            <Typography sx={{ fontSize: 11, color: alpha(ct, 0.35) }}>
              {node.sourceCount}
            </Typography>
          )}
        </Box>
      </Link>
      {expanded &&
        node.children.map((child) => (
          <SourcesTreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </>
  );
}
