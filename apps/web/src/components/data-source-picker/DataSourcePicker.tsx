import type { DbId } from '@grabdy/common';
import type { DataSourceConfig } from '@grabdy/contracts';
import { Box, Stack, Typography } from '@mui/material';

import { CollectionChips } from './components/CollectionChips';
import { PickerSkeleton } from './components/PickerSkeleton';
import { usePickerData } from './hooks/usePickerData';

interface DataSourcePickerProps {
  value: DataSourceConfig;
  onChange: (config: DataSourceConfig) => void;
  orgId: DbId<'Org'>;
}

export function DataSourcePicker({ value, onChange, orgId }: DataSourcePickerProps) {
  const { collections, isLoading } = usePickerData(orgId);

  if (isLoading) {
    return <PickerSkeleton />;
  }

  if (collections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No data sources available. Create a folder first.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {collections.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Folders
          </Typography>
          <CollectionChips
            collections={collections}
            value={value}
            onChange={onChange}
            orgId={orgId}
          />
        </Box>
      )}
    </Stack>
  );
}
