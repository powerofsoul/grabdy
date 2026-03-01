import { useCallback, useMemo, useState } from 'react';

import type { DbId } from '@grabdy/common';
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
import { FloppyDiskIcon, GitForkIcon, HashIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Section } from './Section';

import { PROVIDER_SOURCE_NOUN } from '@/components/data-source-picker/constants';
import { api } from '@/lib/api';

function buildSaveBody(
  provider: 'SLACK' | 'GITHUB',
  selectedIds: ReadonlySet<string>
): {
  config:
    | { provider: 'SLACK'; selectedChannels: string[] }
    | { provider: 'GITHUB'; selectedRepos: string[] };
} {
  const ids = [...selectedIds];
  if (provider === 'SLACK') {
    return { config: { provider: 'SLACK', selectedChannels: ids } };
  }
  return { config: { provider: 'GITHUB', selectedRepos: ids } };
}

export function ResourcePicker({
  provider,
  orgId,
  onRefresh,
}: {
  provider: 'SLACK' | 'GITHUB';
  orgId: DbId<'Org'>;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);

  const [, plural] = PROVIDER_SOURCE_NOUN[provider];
  const capitalPlural = plural.charAt(0).toUpperCase() + plural.slice(1);

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

  const toggleResource = useCallback(
    (resourceId: string) => {
      setSelectedIds((prev) => {
        const base = prev ?? new Set(serverSelectedIds);
        const next = new Set(base);
        if (next.has(resourceId)) {
          next.delete(resourceId);
        } else {
          next.add(resourceId);
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
        body: buildSaveBody(provider, effectiveSelectedIds),
      });
      if (res.status !== 200) throw new Error(`Failed to save ${plural}`);
    },
    onSuccess: () => {
      toast.success(`${capitalPlural} updated, sync started`);
      setSelectedIds(null);
      queryClient.invalidateQueries({ queryKey: ['integrations', 'resources', orgId, provider] });
      onRefresh();
    },
    onError: () => {
      toast.error(`Failed to save ${plural}`);
    },
  });

  const RowIcon = provider === 'GITHUB' ? GitForkIcon : HashIcon;

  const helperText =
    provider === 'SLACK' ? 'Select public channels to sync.' : `Select ${plural} to sync.`;

  if (isLoading) {
    return (
      <Section title={`${capitalPlural} (loading...)`}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </Section>
    );
  }

  return (
    <Section title={`${capitalPlural} (${effectiveSelectedIds.size} selected)`}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
        <TextField
          size="small"
          placeholder={`Search ${plural}...`}
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
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
        />
        <Box
          sx={{
            maxHeight: 280,
            overflow: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 0,
          }}
        >
          {filteredResources.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              {search ? `No ${plural} match your search` : `No ${plural} found`}
            </Typography>
          ) : (
            filteredResources.map((resource) => (
              <Box
                key={resource.id}
                onClick={() => toggleResource(resource.id)}
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
                <RowIcon size={14} weight="light" color={theme.palette.text.secondary} />
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
          sx={{ borderRadius: 0, alignSelf: 'flex-start' }}
        >
          {saveMutation.isPending ? 'Saving...' : `Save ${capitalPlural}`}
        </Button>
      </Box>
    </Section>
  );
}
