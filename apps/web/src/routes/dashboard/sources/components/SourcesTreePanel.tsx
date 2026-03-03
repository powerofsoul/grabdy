import { useMemo } from 'react';

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { HouseIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';

import { SourcesTreeNode } from './SourcesTreeNode';

import { buildTree } from '@/components/ui/Sidebar/helpers';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function SourcesTreePanel() {
  const { selectedOrgId } = useAuth();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const location = useLocation();

  const { data: collections = [] } = useQuery({
    queryKey: ['collections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.collections.list({ params: { orgId: selectedOrgId }, query: {} });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  const tree = useMemo(
    () =>
      buildTree(
        collections.map((c) => ({
          id: c.id,
          name: c.name,
          sourceCount: c.sourceCount,
          parentId: c.parentId,
        }))
      ),
    [collections]
  );

  const isRootActive =
    location.pathname === '/dashboard/sources' || location.pathname === '/dashboard/sources/';

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
        overflowY: 'auto',
        py: 1.5,
        display: { xs: 'none', md: 'block' },
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: alpha(ct, 0.4),
          px: 1.5,
          mb: 0.5,
        }}
      >
        Folders
      </Typography>

      <Link to="/dashboard/sources" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            height: 30,
            px: 1.5,
            cursor: 'pointer',
            bgcolor: isRootActive ? alpha(ct, 0.06) : 'transparent',
            '&:hover': { bgcolor: alpha(ct, isRootActive ? 0.08 : 0.03) },
          }}
        >
          <HouseIcon
            size={14}
            weight="light"
            color="currentColor"
            style={{ color: isRootActive ? undefined : alpha(ct, 0.5) }}
          />
          <Typography
            noWrap
            sx={{
              fontSize: 13,
              fontWeight: isRootActive ? 600 : 400,
              color: isRootActive ? 'text.primary' : 'text.secondary',
            }}
          >
            All files
          </Typography>
        </Box>
      </Link>

      {tree.map((node) => (
        <SourcesTreeNode key={node.id} node={node} depth={0} />
      ))}
    </Box>
  );
}
