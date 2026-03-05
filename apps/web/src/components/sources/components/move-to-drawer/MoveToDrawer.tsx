import { useMemo, useState } from 'react';

import { type DbId, dbIdSchema } from '@grabdy/common';
import { Box, Button, useTheme } from '@mui/material';
import { HouseIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PickerNode } from './PickerNode';
import { PickerRow } from './PickerRow';

import { buildTree } from '@/components/ui/Sidebar/helpers';
import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface MoveToDrawerProps extends DrawerProps {
  dataSourceId: DbId<'DataSource'>;
  currentCollectionId: string;
}

export function MoveToDrawer({ onClose, dataSourceId, currentCollectionId }: MoveToDrawerProps) {
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
          parentId: c.parentId,
        }))
      ),
    [collections]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No org selected');
      const parsedCollectionId = selectedId ? dbIdSchema('Collection').parse(selectedId) : null;
      const res = await api.dataSources.move({
        params: { orgId: selectedOrgId, id: dataSourceId },
        body: { collectionId: parsedCollectionId },
      });
      if (res.status !== 200) throw new Error('Failed to move file');
    },
    onSuccess: () => {
      toast.success('File moved');
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to move file');
    },
  });

  const isSameLocation = selectedId === currentCollectionId;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <PickerRow
          label="Root (no folder)"
          icon={<HouseIcon size={14} weight="light" color="currentColor" />}
          selected={selectedId === null}
          onClick={() => setSelectedId(null)}
          ct={ct}
          depth={0}
        />
        {tree.map((node) => (
          <PickerNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={setSelectedId}
            ct={ct}
            depth={0}
          />
        ))}
      </Box>
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="outlined" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isSameLocation}
        >
          {mutation.isPending ? 'Moving...' : 'Move Here'}
        </Button>
      </Box>
    </Box>
  );
}
