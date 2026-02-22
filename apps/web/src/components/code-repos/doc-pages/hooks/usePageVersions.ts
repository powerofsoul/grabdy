import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function usePageVersions(
  orgId: DbId<'Org'> | undefined,
  dataSourceId: DbId<'DataSource'> | undefined,
  pageId: DbId<'DocPage'> | undefined
) {
  const query = useQuery({
    queryKey: ['code-repos', 'doc-page-versions', orgId, dataSourceId, pageId],
    queryFn: async () => {
      if (!orgId || !dataSourceId || !pageId) return null;
      const res = await api.codeRepos.listDocPageVersions({
        params: { orgId, dataSourceId, pageId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!orgId && !!dataSourceId && !!pageId,
  });

  return { versions: query.data ?? null, loading: query.isLoading };
}
