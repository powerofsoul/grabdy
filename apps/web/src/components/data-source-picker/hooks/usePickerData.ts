import type { DbId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { type IndividuallySelectableProvider, isIndividuallySelectable } from '../constants';
import type { IntegrationSection } from '../types';

import { buildTree } from '@/components/ui/Sidebar/helpers';
import { api } from '@/lib/api';

export function usePickerData(orgId: DbId<'Org'>) {
  const collectionsQuery = useQuery({
    queryKey: ['collections', orgId],
    queryFn: async () => {
      const res = await api.collections.list({ params: { orgId }, query: {} });
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

  // Per individually-selectable provider (excluding GitHub): fetch data sources
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

  // Exhaustive record keyed by IndividuallySelectableProvider.
  const individualQueries: Record<
    IndividuallySelectableProvider,
    { data: Array<{ id: DbId<'DataSource'>; title: string }> | undefined }
  > = {
    SLACK: slackDsQuery,
    NOTION: notionDsQuery,
  };

  const isLoading =
    collectionsQuery.isLoading ||
    connectionsQuery.isLoading ||
    slackDsQuery.isLoading ||
    notionDsQuery.isLoading;

  const collections = buildTree(
    (collectionsQuery.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      sourceCount: c.sourceCount,
    }))
  );

  const integrationSections: IntegrationSection[] = (connectionsQuery.data ?? [])
    .filter((c) => c.status === 'ACTIVE')
    .map((conn) => {
      let dataSources: IntegrationSection['dataSources'] = [];
      if (isIndividuallySelectable(conn.provider)) {
        const dsData = individualQueries[conn.provider].data;
        dataSources = (dsData ?? []).map((ds) => ({ id: ds.id, title: ds.title }));
      }

      // For GitHub, use selectedRepos from providerData as resources
      let resources: IntegrationSection['resources'] = [];
      if (conn.provider === 'GITHUB' && conn.providerData.provider === 'GITHUB') {
        resources = (conn.providerData.selectedRepos ?? []).map((repo) => ({
          id: repo,
          name: repo,
        }));
      }

      return {
        connectionId: conn.id,
        provider: conn.provider,
        dataSources,
        resources,
      };
    });

  return { collections, integrationSections, isLoading };
}
