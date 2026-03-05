import { useMemo, useState } from 'react';

import type { DbId } from '@grabdy/common';
import type { DataSourceConfig } from '@grabdy/contracts';
import { alpha, Box, Checkbox, InputBase, Typography, useTheme } from '@mui/material';
import { FileIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';

import { CollectionChips } from './components/CollectionChips';
import { PickerSkeleton } from './components/PickerSkeleton';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { usePickerData } from './hooks/usePickerData';
import { filterCollections } from './helpers';

interface DataSourcePickerProps {
  value: DataSourceConfig;
  onChange: (config: DataSourceConfig) => void;
  orgId: DbId<'Org'>;
}

export function DataSourcePicker({ value, onChange, orgId }: DataSourcePickerProps) {
  const [filter, setFilter] = useState('');
  const debouncedFilter = useDebouncedValue(filter, 250);
  const lowerFilter = debouncedFilter.toLowerCase();
  const { collections, rootDataSources, isLoading } = usePickerData(
    orgId,
    lowerFilter || undefined
  );
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  const filteredCollections = useMemo(
    () => (lowerFilter ? filterCollections(collections, lowerFilter) : collections),
    [collections, lowerFilter]
  );

  if (isLoading) {
    return <PickerSkeleton />;
  }

  if (collections.length === 0 && rootDataSources.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No data sources available.
      </Typography>
    );
  }

  const selectedDsIds = new Set(
    value
      .filter(
        (s): s is Extract<DataSourceConfig[number], { type: 'DATA_SOURCE' }> =>
          s.type === 'DATA_SOURCE'
      )
      .map((s) => s.dataSourceId)
  );

  const handleDsToggle = (dsId: DbId<'DataSource'>) => {
    const exists = selectedDsIds.has(dsId);
    if (exists) {
      onChange(value.filter((s) => !(s.type === 'DATA_SOURCE' && s.dataSourceId === dsId)));
    } else {
      onChange([...value, { type: 'DATA_SOURCE', dataSourceId: dsId }]);
    }
  };

  const showFilter = collections.length + rootDataSources.length > 5;

  return (
    <Box>
      {showFilter && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            mb: 0.5,
          }}
        >
          <MagnifyingGlassIcon size={14} color={alpha(ct, 0.35)} />
          <InputBase
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter..."
            sx={{
              flex: 1,
              fontSize: 12,
              '& input': { p: 0, height: 28 },
              '& input::placeholder': { color: alpha(ct, 0.35), opacity: 1 },
            }}
          />
        </Box>
      )}
      {filteredCollections.length === 0 && rootDataSources.length === 0 && lowerFilter && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 1, py: 1 }}>
          No matches
        </Typography>
      )}
      <CollectionChips
        collections={filteredCollections}
        value={value}
        onChange={onChange}
        orgId={orgId}
        search={lowerFilter || undefined}
      />
      {rootDataSources.map((ds) => (
        <Box
          key={ds.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 32,
            pl: 3,
            pr: 1,
            '&:hover': { bgcolor: alpha(ct, 0.03) },
          }}
        >
          <Checkbox
            size="small"
            checked={selectedDsIds.has(ds.id)}
            onChange={() => handleDsToggle(ds.id)}
            sx={{ p: 0.25, mx: 0.25 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <FileIcon size={14} weight="light" />
            <Typography noWrap sx={{ fontSize: 13 }}>
              {ds.title}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
