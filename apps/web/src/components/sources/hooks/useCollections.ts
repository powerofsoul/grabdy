import { useMemo } from 'react';

import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useCollections() {
  const { selectedOrgId } = useAuth();

  const query = useQuery({
    queryKey: ['collections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.collections.list({ params: { orgId: selectedOrgId }, query: {} });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  return { collections: query.data ?? [], isLoading: query.isLoading };
}

export function useCollection(collectionId: string | null) {
  const { collections, isLoading } = useCollections();

  const collection = useMemo(
    () => (collectionId ? (collections.find((c) => c.id === collectionId) ?? null) : null),
    [collections, collectionId]
  );

  return { collection, isLoading };
}

export function useChildCollections(collectionId: DbId<'Collection'> | null) {
  const { collections, isLoading } = useCollections();

  const children = useMemo(
    () =>
      collectionId
        ? collections.filter((c) => c.parentId === collectionId)
        : collections.filter((c) => c.parentId === null),
    [collections, collectionId]
  );

  return { children, isLoading };
}

export function useBreadcrumb(collectionId: string | null) {
  const { collections } = useCollections();

  return useMemo(() => {
    if (!collectionId || collections.length === 0) return [];

    const byId = new Map<string, { id: string; name: string; parentId: string | null }>();
    for (const c of collections) {
      byId.set(c.id, c);
    }

    const crumbs: { id: string; name: string }[] = [];
    let currentId: string | null = collectionId;

    while (currentId) {
      const coll = byId.get(currentId);
      if (!coll) break;
      crumbs.unshift({ id: coll.id, name: coll.name });
      currentId = coll.parentId;
    }

    return crumbs;
  }, [collectionId, collections]);
}
