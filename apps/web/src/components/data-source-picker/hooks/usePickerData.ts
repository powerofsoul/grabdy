import type { DbId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { type IndividuallySelectableProvider, isIndividuallySelectable } from '../constants';
import type { CollectionOption, DataSourceItem, IntegrationSection } from '../types';

import { api } from '@/lib/api';

export function usePickerData(orgId: DbId<'Org'>) {
  const collectionsQuery = useQuery({
    queryKey: ['collections', orgId],
    queryFn: async () => {
      const res = await api.collections.list({ params: { orgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  // Fetch only data sources that belong to a collection (excludes integration DS)
  const allDsQuery = useQuery({
    queryKey: ['dataSources', orgId, 'withCollection'],
    queryFn: async () => {
      const res = await api.dataSources.list({
        params: { orgId },
        query: { hasCollection: true },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ['integrations', 'connections', orgId],
    queryFn: async () => {
      const res = await api.integrations.listConnections({ params: { orgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  const hasActiveProvider = (provider: IntegrationProvider) =>
    connectionsQuery.data?.some((c) => c.provider === provider && c.status === 'ACTIVE');

  // Per individually-selectable provider: fetch data sources
  const slackDsQuery = useQuery({
    queryKey: ['dataSources', orgId, 'byType', 'SLACK'],
    queryFn: async () => {
      const res = await api.dataSources.list({ params: { orgId }, query: { type: 'SLACK' } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: hasActiveProvider('SLACK'),
  });

  const notionDsQuery = useQuery({
    queryKey: ['dataSources', orgId, 'byType', 'NOTION'],
    queryFn: async () => {
      const res = await api.dataSources.list({ params: { orgId }, query: { type: 'NOTION' } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: hasActiveProvider('NOTION'),
  });

  const githubDsQuery = useQuery({
    queryKey: ['dataSources', orgId, 'byType', 'GITHUB'],
    queryFn: async () => {
      const res = await api.dataSources.list({ params: { orgId }, query: { type: 'GITHUB' } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: hasActiveProvider('GITHUB'),
  });

  // Exhaustive record keyed by IndividuallySelectableProvider.
  // Adding a new entry to INDIVIDUALLY_SELECTABLE_PROVIDERS without adding
  // a query + entry here will produce a compile error.
  const individualQueries: Record<
    IndividuallySelectableProvider,
    { data: Array<{ id: DbId<'DataSource'>; title: string }> | undefined }
  > = {
    SLACK: slackDsQuery,
    NOTION: notionDsQuery,
    GITHUB: githubDsQuery,
  };

  const isLoading =
    collectionsQuery.isLoading ||
    allDsQuery.isLoading ||
    connectionsQuery.isLoading ||
    slackDsQuery.isLoading ||
    notionDsQuery.isLoading ||
    githubDsQuery.isLoading;

  // Group data sources by collectionId
  const dsByCollection = new Map<string, DataSourceItem[]>();
  for (const ds of allDsQuery.data ?? []) {
    if (!ds.collectionId) continue;
    const list = dsByCollection.get(ds.collectionId);
    const item: DataSourceItem = { id: ds.id, title: ds.title };
    if (list) {
      list.push(item);
    } else {
      dsByCollection.set(ds.collectionId, [item]);
    }
  }

  const collections: CollectionOption[] = (collectionsQuery.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    dataSources: dsByCollection.get(c.id) ?? [],
  }));

  const integrationSections: IntegrationSection[] = (connectionsQuery.data ?? [])
    .filter((c) => c.status === 'ACTIVE')
    .map((conn) => {
      let dataSources: IntegrationSection['dataSources'] = [];
      if (isIndividuallySelectable(conn.provider)) {
        const dsData = individualQueries[conn.provider].data;
        dataSources = (dsData ?? []).map((ds) => ({ id: ds.id, title: ds.title }));
      }

      return {
        connectionId: conn.id,
        provider: conn.provider,
        dataSources,
      };
    });

  return { collections, integrationSections, isLoading };
}
