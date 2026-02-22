import type { DbId } from '@grabdy/common';
import type { AvailableRepo } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useAvailableRepos(orgId: DbId<'Org'> | undefined) {
  const query = useQuery({
    queryKey: ['code-repos', 'available', orgId],
    queryFn: async (): Promise<AvailableRepo[]> => {
      if (!orgId) return [];
      const res = await api.codeRepos.listAvailableRepos({
        params: { orgId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return [];
    },
    enabled: !!orgId,
  });

  return {
    repos: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
