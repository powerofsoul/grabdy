import { useCallback, useState } from 'react';

import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';
import { alpha, Box, Checkbox, CircularProgress, Typography, useTheme } from '@mui/material';
import { CaretDownIcon, CaretRightIcon, FileIcon, FolderIcon } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  collectAllChildCollectionIds,
  collectAllDataSourceIds,
  type DataSourceGetter,
  explodeFolderExcluding,
  hasDescendantSelection,
} from '../helpers';
import type { CollectionOption, DataSourceItem } from '../types';

import { api } from '@/lib/api';

interface CollectionSectionProps {
  collection: CollectionOption;
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
  orgId: DbId<'Org'>;
  depth: number;
  ancestorSelected: boolean;
  /** Called when a child wants to deselect itself while under a selected ancestor. */
  onDeselectInherited?: (excludeId: string, isDataSource: boolean) => void;
}

/** Query key for lazily-loaded folder data sources in the picker. */
function pickerDsKey(orgId: DbId<'Org'>, collectionId: DbId<'Collection'>) {
  return ['pickerDs', orgId, collectionId] as const;
}

export function CollectionSection({
  collection,
  value,
  onChange,
  orgId,
  depth,
  ancestorSelected,
  onDeselectInherited,
}: CollectionSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const queryClient = useQueryClient();

  // Lazy-load data sources for this folder when expanded
  const { data: folderDataSources = [], isLoading: isDsLoading } = useQuery({
    queryKey: pickerDsKey(orgId, collection.id),
    queryFn: async () => {
      const res = await api.dataSources.list({
        params: { orgId },
        query: { collectionId: collection.id },
      });
      if (res.status === 200) {
        return res.body.data.map((ds): DataSourceItem => ({ id: ds.id, title: ds.title }));
      }
      return [];
    },
    enabled: expanded,
  });

  /** Read cached data sources for any folder (used by helpers during explode). */
  const getDataSources: DataSourceGetter = useCallback(
    (collectionId: DbId<'Collection'>) =>
      queryClient.getQueryData<DataSourceItem[]>(pickerDsKey(orgId, collectionId)) ?? [],
    [queryClient, orgId]
  );

  const isSelected = value.some((s) => s.type === 'COLLECTION' && s.collectionId === collection.id);
  const isChecked = isSelected || ancestorSelected;
  const isIndeterminate =
    !isSelected && !ancestorSelected && hasDescendantSelection(collection, value, getDataSources);
  const hasContent = collection.sourceCount > 0 || collection.children.length > 0;

  const handleChildDeselect = (excludeId: string, isDataSource: boolean) => {
    const exploded = explodeFolderExcluding(collection, excludeId, isDataSource, getDataSources);
    const without = value.filter(
      (s) => !(s.type === 'COLLECTION' && s.collectionId === collection.id)
    );
    onChange([...without, ...exploded]);
  };

  const childDeselectCallback = isSelected ? handleChildDeselect : onDeselectInherited;

  const handleToggle = () => {
    if (ancestorSelected) {
      onDeselectInherited?.(collection.id, false);
      return;
    }
    if (isSelected) {
      onChange(value.filter((s) => !(s.type === 'COLLECTION' && s.collectionId === collection.id)));
    } else {
      const dsIds = collectAllDataSourceIds(collection, getDataSources);
      const childIds = collectAllChildCollectionIds(collection);
      const filtered = value.filter((s) => {
        if (s.type === 'DATA_SOURCE' && dsIds.has(s.dataSourceId)) return false;
        if (s.type === 'COLLECTION' && childIds.has(s.collectionId)) return false;
        return true;
      });
      onChange([...filtered, { type: 'COLLECTION', collectionId: collection.id }]);
    }
  };

  const handleDsToggle = (dsId: DataSourceItem['id']) => {
    if (isChecked) {
      if (isSelected) {
        handleChildDeselect(dsId, true);
      } else {
        onDeselectInherited?.(dsId, true);
      }
      return;
    }
    const exists = value.some((s) => s.type === 'DATA_SOURCE' && s.dataSourceId === dsId);
    if (exists) {
      onChange(value.filter((s) => !(s.type === 'DATA_SOURCE' && s.dataSourceId === dsId)));
    } else {
      onChange([...value, { type: 'DATA_SOURCE', dataSourceId: dsId }]);
    }
  };

  const toggleExpand = () => {
    if (hasContent) setExpanded((p) => !p);
  };

  const selectedDsIds = new Set(
    value
      .filter(
        (s): s is Extract<BotSourceConfig[number], { type: 'DATA_SOURCE' }> =>
          s.type === 'DATA_SOURCE'
      )
      .map((s) => s.dataSourceId)
  );

  return (
    <>
      {/* Folder row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          pl: 1 + depth * 2,
          pr: 1,
          '&:hover': { bgcolor: alpha(ct, 0.03) },
        }}
      >
        <Box
          onClick={toggleExpand}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            flexShrink: 0,
            cursor: hasContent ? 'pointer' : 'default',
          }}
        >
          {hasContent &&
            (expanded ? (
              <CaretDownIcon size={12} weight="bold" />
            ) : (
              <CaretRightIcon size={12} weight="bold" />
            ))}
        </Box>
        <Checkbox
          size="small"
          checked={isChecked}
          indeterminate={isIndeterminate}
          onChange={handleToggle}
          sx={{ p: 0.25, mx: 0.25 }}
        />
        <Box
          onClick={toggleExpand}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flex: 1,
            minWidth: 0,
            cursor: hasContent ? 'pointer' : 'default',
          }}
        >
          <FolderIcon size={14} weight="light" />
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
            {collection.name}
          </Typography>
          {isChecked && (
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 600,
                color: 'primary.main',
                bgcolor: 'action.selected',
                px: 0.75,
                py: 0.125,
                lineHeight: 1.4,
                flexShrink: 0,
              }}
            >
              All
            </Typography>
          )}
          {collection.sourceCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {collection.sourceCount}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Expanded children */}
      {expanded && (
        <>
          {isDsLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                height: 32,
                pl: 1 + (depth + 1) * 2 + 2,
              }}
            >
              <CircularProgress size={12} />
              <Typography variant="caption" color="text.secondary">
                Loading files...
              </Typography>
            </Box>
          ) : (
            folderDataSources.map((ds) => {
              const dsSelected = selectedDsIds.has(ds.id);
              return (
                <Box
                  key={ds.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    height: 32,
                    pl: 1 + (depth + 1) * 2 + 2,
                    pr: 1,
                    '&:hover': { bgcolor: alpha(ct, 0.03) },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isChecked || dsSelected}
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
              );
            })
          )}
          {collection.children.map((child) => (
            <CollectionSection
              key={child.id}
              collection={child}
              value={value}
              onChange={onChange}
              orgId={orgId}
              depth={depth + 1}
              ancestorSelected={isChecked}
              onDeselectInherited={childDeselectCallback}
            />
          ))}
        </>
      )}
    </>
  );
}
