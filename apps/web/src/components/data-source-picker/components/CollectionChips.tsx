import type { DbId } from '@grabdy/common';
import type { DataSourceConfig } from '@grabdy/contracts';
import { Box } from '@mui/material';

import type { CollectionOption } from '../types';

import { CollectionSection } from './CollectionSection';

interface CollectionChipsProps {
  collections: CollectionOption[];
  value: DataSourceConfig;
  onChange: (config: DataSourceConfig) => void;
  orgId: DbId<'Org'>;
  search?: string;
}

export function CollectionChips({
  collections,
  value,
  onChange,
  orgId,
  search,
}: CollectionChipsProps) {
  if (collections.length === 0) return null;

  return (
    <Box>
      {collections.map((collection) => (
        <CollectionSection
          key={collection.id}
          collection={collection}
          value={value}
          onChange={onChange}
          orgId={orgId}
          depth={0}
          ancestorSelected={false}
          search={search}
        />
      ))}
    </Box>
  );
}
