import { useState } from 'react';

import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';
import {
  Box,
  Checkbox,
  CircularProgress,
  Collapse,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';

import { DataSourceRow } from './DataSourceRow';

import { api } from '@/lib/api';

interface CollectionRowProps {
  id: DbId<'Collection'>;
  name: string;
  orgId: DbId<'Org'>;
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
}

export function CollectionRow({ id, name, orgId, value, onChange }: CollectionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const isCollectionSelected = value.some((s) => s.type === 'COLLECTION' && s.collectionId === id);

  const { data: dataSources, isLoading } = useQuery({
    queryKey: ['dataSources', orgId, id],
    queryFn: async () => {
      const res = await api.dataSources.list({
        params: { orgId },
        query: { collectionId: id },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
    staleTime: 60_000,
  });

  const selectedSourceIds = new Set(
    value
      .filter((s) => s.type === 'DATA_SOURCE')
      .map((s) => {
        if (s.type === 'DATA_SOURCE') return s.dataSourceId;
        return '';
      })
  );

  // Check if some individual data sources from this collection are selected
  const selectedCount = dataSources?.filter((ds) => selectedSourceIds.has(ds.id)).length ?? 0;
  const totalCount = dataSources?.length ?? 0;
  const hasPartialSelection = !isCollectionSelected && selectedCount > 0;
  const hasFullIndividualSelection =
    !isCollectionSelected && totalCount > 0 && selectedCount === totalCount;

  const handleCollectionToggle = (_: React.ChangeEvent, checked: boolean) => {
    if (checked) {
      // Add collection, remove any individual sources from this collection
      const filtered = value.filter((s) => {
        if (s.type === 'COLLECTION' && s.collectionId === id) return false;
        if (s.type === 'DATA_SOURCE' && dataSources?.some((ds) => ds.id === s.dataSourceId)) {
          return false;
        }
        return true;
      });
      onChange([...filtered, { type: 'COLLECTION', collectionId: id }]);
    } else {
      // Remove collection and any individual sources from this collection
      onChange(
        value.filter((s) => {
          if (s.type === 'COLLECTION' && s.collectionId === id) return false;
          if (s.type === 'DATA_SOURCE' && dataSources?.some((ds) => ds.id === s.dataSourceId)) {
            return false;
          }
          return true;
        })
      );
    }
  };

  const handleSourceToggle = (dataSourceId: DbId<'DataSource'>, checked: boolean) => {
    if (checked) {
      onChange([...value, { type: 'DATA_SOURCE', dataSourceId }]);
    } else {
      onChange(value.filter((s) => !(s.type === 'DATA_SOURCE' && s.dataSourceId === dataSourceId)));
    }
  };

  return (
    <>
      <ListItemButton onClick={() => setExpanded((p) => !p)} dense>
        <Box sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>
          {expanded ? <CaretDownIcon size={14} /> : <CaretRightIcon size={14} />}
        </Box>
        <Checkbox
          checked={isCollectionSelected || hasFullIndividualSelection}
          indeterminate={hasPartialSelection}
          onChange={handleCollectionToggle}
          onClick={(e) => e.stopPropagation()}
          size="small"
        />
        <ListItemText
          primary={name}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
        />
      </ListItemButton>
      <Collapse in={expanded}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={16} />
          </Box>
        )}
        {dataSources?.map((ds) => (
          <DataSourceRow
            key={ds.id}
            id={ds.id}
            title={ds.title}
            checked={isCollectionSelected || selectedSourceIds.has(ds.id)}
            onToggle={handleSourceToggle}
          />
        ))}
      </Collapse>
    </>
  );
}
