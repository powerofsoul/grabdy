import { useState } from 'react';

import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';
import { Box, Collapse, Stack, Typography } from '@mui/material';
import { CaretDownIcon, CaretRightIcon, FolderSimpleIcon } from '@phosphor-icons/react';

import type { CollectionOption } from '../types';

import { SourceChip } from './SourceChip';

interface CollectionChipsProps {
  collections: CollectionOption[];
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
}

export function CollectionChips({ collections, value, onChange }: CollectionChipsProps) {
  if (collections.length === 0) return null;

  return (
    <Stack spacing={1}>
      {collections.map((collection) => (
        <CollectionSection
          key={collection.id}
          collection={collection}
          value={value}
          onChange={onChange}
        />
      ))}
    </Stack>
  );
}

function CollectionSection({
  collection,
  value,
  onChange,
}: {
  collection: CollectionOption;
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const allSelected = value.some(
    (s) => s.type === 'COLLECTION' && s.collectionId === collection.id
  );

  const selectedDsIds = new Set(
    value
      .filter(
        (s): s is Extract<BotSourceConfig[number], { type: 'DATA_SOURCE' }> =>
          s.type === 'DATA_SOURCE'
      )
      .map((s) => s.dataSourceId)
  );

  const selectedCount = collection.dataSources.filter((ds) => selectedDsIds.has(ds.id)).length;
  const hasSelection = allSelected || selectedCount > 0;

  const handleAllToggle = () => {
    if (allSelected) {
      onChange(value.filter((s) => !(s.type === 'COLLECTION' && s.collectionId === collection.id)));
    } else {
      const collDsIds = new Set(collection.dataSources.map((ds) => ds.id));
      const filtered = value.filter(
        (s) => !(s.type === 'DATA_SOURCE' && collDsIds.has(s.dataSourceId))
      );
      onChange([...filtered, { type: 'COLLECTION', collectionId: collection.id }]);
    }
  };

  const handleDsToggle = (dsId: DbId<'DataSource'>) => {
    if (selectedDsIds.has(dsId)) {
      onChange(value.filter((s) => !(s.type === 'DATA_SOURCE' && s.dataSourceId === dsId)));
    } else {
      onChange([...value, { type: 'DATA_SOURCE', dataSourceId: dsId }]);
    }
  };

  const Caret = expanded ? CaretDownIcon : CaretRightIcon;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        onClick={() => setExpanded((p) => !p)}
        sx={{ cursor: 'pointer', py: 0.5, '&:hover': { opacity: 0.8 } }}
      >
        <Caret size={12} weight="bold" />
        <FolderSimpleIcon size={15} weight="light" />
        <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
          {collection.name}
        </Typography>
        {hasSelection && (
          <Typography variant="caption" color="text.secondary">
            {allSelected ? 'All' : `${selectedCount}/${collection.dataSources.length}`}
          </Typography>
        )}
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 0.75, pl: 2.5 }}>
          {collection.dataSources.length > 1 && (
            <SourceChip label="All" selected={allSelected} onClick={handleAllToggle} />
          )}
          {collection.dataSources.map((ds) => (
            <SourceChip
              key={ds.id}
              label={ds.title}
              selected={allSelected || selectedDsIds.has(ds.id)}
              disabled={allSelected}
              onClick={() =>
                collection.dataSources.length === 1 ? handleAllToggle() : handleDsToggle(ds.id)
              }
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
