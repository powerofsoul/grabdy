import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useFolderContents(collectionId: DbId<'Collection'> | null) {
  const { selectedOrgId } = useAuth();

  const foldersQuery = useQuery({
    queryKey: ['collections', selectedOrgId, 'children', collectionId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.collections.list({
        params: { orgId: selectedOrgId },
        query: collectionId ? { parentId: collectionId } : {},
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  // When at root, the query returns ALL collections; filter to root-level only
  const folders = collectionId
    ? (foldersQuery.data ?? [])
    : (foldersQuery.data ?? []).filter((c) => c.parentId === null);

  const sourcesQuery = useQuery({
    queryKey: ['dataSources', selectedOrgId, 'inFolder', collectionId],
    queryFn: async () => {
      if (!selectedOrgId || !collectionId) return [];
      const res = await api.dataSources.list({
        params: { orgId: selectedOrgId },
        query: { collectionId },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId && !!collectionId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((ds) => ds.status === 'DELETING' || ds.status === 'PROCESSING')) return 3000;
      return false;
    },
  });

  return {
    folders,
    sources: sourcesQuery.data ?? [],
    isLoading: foldersQuery.isLoading || sourcesQuery.isLoading,
  };
}
