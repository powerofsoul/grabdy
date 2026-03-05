import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import type { DataSourceItem } from '../types';

import { buildTree } from '@/components/ui/Sidebar/helpers';
import { api } from '@/lib/api';

export function usePickerData(orgId: DbId<'Org'>, search?: string) {
  const collectionsQuery = useQuery({
    queryKey: ['collections', orgId],
    queryFn: async () => {
      const res = await api.collections.list({ params: { orgId }, query: {} });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  const rootSourcesQuery = useQuery({
    queryKey: ['pickerRootDs', orgId, search ?? ''],
    queryFn: async () => {
      const res = await api.dataSources.list({
        params: { orgId },
        query: { rootOnly: true, search: search || undefined },
      });
      if (res.status === 200) {
        return res.body.data.map((ds): DataSourceItem => ({ id: ds.id, title: ds.title }));
      }
      return [];
    },
  });

  const isLoading = collectionsQuery.isLoading || rootSourcesQuery.isLoading;

  const collections = buildTree(
    (collectionsQuery.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      sourceCount: c.sourceCount,
    }))
  );

  const rootDataSources = rootSourcesQuery.data ?? [];

  return { collections, rootDataSources, isLoading };
}
