import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { useChildCollections } from './useCollections';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useFolderContents(collectionId: DbId<'Collection'> | null) {
  const { selectedOrgId } = useAuth();
  const { children: folders, isLoading: isFoldersLoading } = useChildCollections(collectionId);

  const sourcesQuery = useQuery({
    queryKey: ['dataSources', selectedOrgId, 'inFolder', collectionId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      if (collectionId) {
        const res = await api.dataSources.list({
          params: { orgId: selectedOrgId },
          query: { collectionId },
        });
        if (res.status === 200) return res.body.data;
      } else {
        const res = await api.dataSources.list({
          params: { orgId: selectedOrgId },
          query: { rootOnly: true },
        });
        if (res.status === 200) return res.body.data;
      }
      return [];
    },
    enabled: !!selectedOrgId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((ds) => ds.status === 'DELETING' || ds.status === 'PROCESSING')) return 3000;
      return false;
    },
  });

  return {
    folders,
    sources: sourcesQuery.data ?? [],
    isLoading: isFoldersLoading || sourcesQuery.isLoading,
  };
}
