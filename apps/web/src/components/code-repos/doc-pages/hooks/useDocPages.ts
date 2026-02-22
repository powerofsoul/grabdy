import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useDocPages(
  orgId: DbId<'Org'> | undefined,
  dataSourceId: DbId<'DataSource'> | undefined
) {
  const query = useQuery({
    queryKey: ['code-repos', 'doc-pages', orgId, dataSourceId],
    queryFn: async () => {
      if (!orgId || !dataSourceId) return null;
      const res = await api.codeRepos.listDocPages({
        params: { orgId, dataSourceId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!orgId && !!dataSourceId,
  });

  return { pages: query.data ?? null, loading: query.isLoading };
}
