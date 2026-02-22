import type { DbId } from '@grabdy/common';
import type { DocVersion } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useDocsHistory(
  orgId: DbId<'Org'> | undefined,
  dataSourceId: DbId<'DataSource'> | undefined
) {
  const query = useQuery({
    queryKey: ['code-repos', 'docs-history', orgId, dataSourceId],
    queryFn: async (): Promise<DocVersion[]> => {
      if (!orgId || !dataSourceId) return [];
      const res = await api.codeRepos.getDocsHistory({
        params: { orgId, dataSourceId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return [];
    },
    enabled: !!orgId && !!dataSourceId,
  });

  return {
    versions: query.data ?? [],
    loading: query.isLoading,
  };
}
