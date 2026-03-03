import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function useFolderBreadcrumb(collectionId: string | null) {
  const { selectedOrgId } = useAuth();

  const allCollectionsQuery = useQuery({
    queryKey: ['collections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.collections.list({ params: { orgId: selectedOrgId }, query: {} });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  return useMemo(() => {
    if (!collectionId || !allCollectionsQuery.data) {
      return [];
    }

    const byId = new Map<string, { id: string; name: string; parentId: string | null }>();
    for (const c of allCollectionsQuery.data) {
      byId.set(c.id, c);
    }

    const crumbs: BreadcrumbItem[] = [];
    let currentId: string | null = collectionId;

    while (currentId) {
      const coll = byId.get(currentId);
      if (!coll) break;
      crumbs.unshift({ id: coll.id, name: coll.name });
      currentId = coll.parentId;
    }

    return crumbs;
  }, [collectionId, allCollectionsQuery.data]);
}
