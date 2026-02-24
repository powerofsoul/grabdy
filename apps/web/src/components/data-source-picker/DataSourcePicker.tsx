import type { DbId } from '@grabdy/common';
import type { SdkChatSourceConfig } from '@grabdy/contracts';
import { Box, CircularProgress, List, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { CollectionRow } from './components/CollectionRow';

import { api } from '@/lib/api';

interface DataSourcePickerProps {
  value: SdkChatSourceConfig;
  onChange: (config: SdkChatSourceConfig) => void;
  orgId: DbId<'Org'>;
}

export function DataSourcePicker({ value, onChange, orgId }: DataSourcePickerProps) {
  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections', orgId],
    queryFn: async () => {
      const res = await api.collections.list({ params: { orgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!collections?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No collections found. Create a collection and upload data sources first.
      </Typography>
    );
  }

  return (
    <List disablePadding>
      {collections.map((c) => (
        <CollectionRow
          key={c.id}
          id={c.id}
          name={c.name}
          orgId={orgId}
          value={value}
          onChange={onChange}
        />
      ))}
    </List>
  );
}
