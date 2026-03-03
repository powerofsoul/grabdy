import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';

import type { CollectionOption, DataSourceItem } from './types';

export type DataSourceGetter = (collectionId: DbId<'Collection'>) => DataSourceItem[];

/** Check if any descendant data source or child folder is individually selected. */
export function hasDescendantSelection(
  node: CollectionOption,
  value: BotSourceConfig,
  getDataSources: DataSourceGetter
): boolean {
  const selectedDsIds = new Set(
    value
      .filter(
        (s): s is Extract<BotSourceConfig[number], { type: 'DATA_SOURCE' }> =>
          s.type === 'DATA_SOURCE'
      )
      .map((s) => s.dataSourceId)
  );

  const folderDs = getDataSources(node.id);
  if (folderDs.some((ds) => selectedDsIds.has(ds.id))) return true;

  for (const child of node.children) {
    if (value.some((s) => s.type === 'COLLECTION' && s.collectionId === child.id)) return true;
    if (hasDescendantSelection(child, value, getDataSources)) return true;
  }

  return false;
}

/** Collect all data source IDs from a folder and all its descendants (from cache). */
export function collectAllDataSourceIds(
  node: CollectionOption,
  getDataSources: DataSourceGetter
): Set<DbId<'DataSource'>> {
  const ids = new Set<DbId<'DataSource'>>();
  for (const ds of getDataSources(node.id)) ids.add(ds.id);
  for (const child of node.children) {
    for (const id of collectAllDataSourceIds(child, getDataSources)) ids.add(id);
  }
  return ids;
}

/** Collect all child collection IDs (recursively, excludes the root). */
export function collectAllChildCollectionIds(node: CollectionOption): Set<DbId<'Collection'>> {
  const ids = new Set<DbId<'Collection'>>();
  for (const child of node.children) {
    ids.add(child.id);
    for (const id of collectAllChildCollectionIds(child)) ids.add(id);
  }
  return ids;
}

/** Check if a folder or any descendant folder contains a specific data source. */
function containsDataSource(
  folder: CollectionOption,
  dsId: string,
  getDataSources: DataSourceGetter
): boolean {
  if (getDataSources(folder.id).some((ds) => ds.id === dsId)) return true;
  return folder.children.some((child) => containsDataSource(child, dsId, getDataSources));
}

/**
 * "Explode" a selected folder into individual entries, excluding one item.
 * Sibling folders that don't contain the excluded item become COLLECTION entries.
 * The child folder containing the excluded DS is recursively exploded.
 */
export function explodeFolderExcluding(
  folder: CollectionOption,
  excludeId: string,
  isDataSource: boolean,
  getDataSources: DataSourceGetter
): BotSourceConfig {
  const entries: BotSourceConfig = [];

  for (const ds of getDataSources(folder.id)) {
    if (isDataSource && ds.id === excludeId) continue;
    entries.push({ type: 'DATA_SOURCE', dataSourceId: ds.id });
  }

  for (const child of folder.children) {
    if (!isDataSource && child.id === excludeId) continue;
    if (isDataSource && containsDataSource(child, excludeId, getDataSources)) {
      entries.push(...explodeFolderExcluding(child, excludeId, true, getDataSources));
    } else {
      entries.push({ type: 'COLLECTION', collectionId: child.id });
    }
  }

  return entries;
}
