import type { DbId } from '@grabdy/common';
import type { RepoDocs } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useRepoDocs(
  orgId: DbId<'Org'> | undefined,
  dataSourceId: DbId<'DataSource'> | undefined
) {
  const query = useQuery({
    queryKey: ['code-repos', 'docs', orgId, dataSourceId],
    queryFn: async (): Promise<RepoDocs | null> => {
      if (!orgId || !dataSourceId) return null;
      const res = await api.codeRepos.getDocs({
        params: { orgId, dataSourceId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return null;
    },
    enabled: !!orgId && !!dataSourceId,
  });

  return {
    docs: query.data ?? null,
    loading: query.isLoading,
  };
}
