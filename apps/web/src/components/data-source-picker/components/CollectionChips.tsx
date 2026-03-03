import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';
import { Box } from '@mui/material';

import type { CollectionOption } from '../types';

import { CollectionSection } from './CollectionSection';

interface CollectionChipsProps {
  collections: CollectionOption[];
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
  orgId: DbId<'Org'>;
}

export function CollectionChips({ collections, value, onChange, orgId }: CollectionChipsProps) {
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
        />
      ))}
    </Box>
  );
}
