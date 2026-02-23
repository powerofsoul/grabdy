import { useCallback, useMemo, useState } from 'react';

import type { DbId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { FloppyDiskIcon, HashIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Section } from './Section';

import { api } from '@/lib/api';

export function ChannelPicker({
  provider,
  orgId,
  onRefresh,
}: {
  provider: IntegrationProvider;
  orgId: DbId<'Org'>;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['integrations', 'resources', orgId, provider],
    queryFn: async () => {
      const res = await api.integrations.listResources({
        params: { orgId, provider },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  const serverSelectedIds = useMemo(
    () => new Set(resources.filter((r) => r.selected).map((r) => r.id)),
    [resources]
  );

  const effectiveSelectedIds = selectedIds ?? serverSelectedIds;

  const filteredResources = useMemo(() => {
    if (!search) return resources;
    const lower = search.toLowerCase();
    return resources.filter((r) => r.name.toLowerCase().includes(lower));
  }, [resources, search]);

  const hasChanges = useMemo(() => {
    if (!selectedIds) return false;
    if (selectedIds.size !== serverSelectedIds.size) return true;
    for (const id of selectedIds) {
      if (!serverSelectedIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, serverSelectedIds]);

  const toggleChannel = useCallback(
    (channelId: string) => {
      setSelectedIds((prev) => {
        const base = prev ?? new Set(serverSelectedIds);
        const next = new Set(base);
        if (next.has(channelId)) {
          next.delete(channelId);
        } else {
          next.add(channelId);
        }
        return next;
      });
    },
    [serverSelectedIds]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.integrations.updateConfig({
        params: { orgId, provider },
        body: { config: { provider: 'SLACK', selectedChannels: [...effectiveSelectedIds] } },
      });
      if (res.status !== 200) throw new Error('Failed to save channels');
    },
    onSuccess: () => {
      toast.success('Channels updated, sync started');
      setSelectedIds(null);
      queryClient.invalidateQueries({ queryKey: ['integrations', 'resources', orgId, provider] });
      onRefresh();
    },
    onError: () => {
      toast.error('Failed to save channels');
    },
  });

  if (isLoading) {
    return (
      <Section title={`Channels (loading...)`}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </Section>
    );
  }

  return (
    <Section title={`Channels (${effectiveSelectedIds.size} selected)`}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Select public channels to sync. Private channels require a manual /invite.
        </Typography>
        <TextField
          size="small"
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <MagnifyingGlassIcon
                  size={16}
                  weight="light"
                  color={theme.palette.text.secondary}
                  style={{ marginRight: 8 }}
                />
              ),
            },
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
        />
        <Box
          sx={{
            maxHeight: 280,
            overflow: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          {filteredResources.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              {search ? 'No channels match your search' : 'No channels found'}
            </Typography>
          ) : (
            filteredResources.map((resource) => (
              <Box
                key={resource.id}
                onClick={() => toggleChannel(resource.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Checkbox
                  checked={effectiveSelectedIds.has(resource.id)}
                  size="small"
                  sx={{ p: 0.5 }}
                  tabIndex={-1}
                />
                <HashIcon size={14} weight="light" color={theme.palette.text.secondary} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {resource.name}
                </Typography>
              </Box>
            ))
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          disabled={!hasChanges || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          startIcon={<FloppyDiskIcon size={15} weight="light" />}
          sx={{ borderRadius: 1.5, alignSelf: 'flex-start' }}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Channels'}
        </Button>
      </Box>
    </Section>
  );
}
