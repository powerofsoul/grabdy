import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useThreadShares(threadId: DbId<'ChatThread'>) {
  const { selectedOrgId } = useAuth();

  return useQuery({
    queryKey: ['threadShares', selectedOrgId, threadId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.sharedChats.listShares({
        params: { orgId: selectedOrgId, threadId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return [];
    },
    enabled: !!selectedOrgId,
  });
}
