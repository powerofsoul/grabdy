import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

import { CollectionChips } from './components/CollectionChips';
import { IntegrationChips } from './components/IntegrationChips';
import { usePickerData } from './hooks/usePickerData';

interface DataSourcePickerProps {
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
  orgId: DbId<'Org'>;
}

export function DataSourcePicker({ value, onChange, orgId }: DataSourcePickerProps) {
  const { collections, integrationSections, isLoading } = usePickerData(orgId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (collections.length === 0 && integrationSections.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No data sources available. Create a collection or connect an integration first.
      </Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      {collections.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Collections
          </Typography>
          <CollectionChips collections={collections} value={value} onChange={onChange} />
        </Box>
      )}
      {integrationSections.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Integrations
          </Typography>
          <IntegrationChips sections={integrationSections} value={value} onChange={onChange} />
        </Box>
      )}
    </Stack>
  );
}
