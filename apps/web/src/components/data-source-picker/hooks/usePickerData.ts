import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

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

  const isLoading = collectionsQuery.isLoading;

  const collections = buildTree(
    (collectionsQuery.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      sourceCount: c.sourceCount,
    }))
  );

  return { collections, isLoading };
}
