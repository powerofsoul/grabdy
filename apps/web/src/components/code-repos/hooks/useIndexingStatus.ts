import type { DbId } from '@grabdy/common';
import type { IndexingStatus } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

const POLL_INTERVAL_MS = 5000;

export function useIndexingStatus(
  orgId: DbId<'Org'> | undefined,
  dataSourceId: DbId<'DataSource'> | undefined
) {
  const query = useQuery({
    queryKey: ['code-repos', 'status', orgId, dataSourceId],
    queryFn: async (): Promise<IndexingStatus | null> => {
      if (!orgId || !dataSourceId) return null;
      const res = await api.codeRepos.getStatus({
        params: { orgId, dataSourceId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return null;
    },
    enabled: !!orgId && !!dataSourceId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'PROCESSING' ? POLL_INTERVAL_MS : false;
    },
  });

  return {
    status: query.data ?? null,
    loading: query.isLoading,
  };
}
