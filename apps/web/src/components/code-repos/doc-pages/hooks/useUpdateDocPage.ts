import type { DbId } from '@grabdy/common';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useUpdateDocPage(
  orgId: DbId<'Org'> | undefined,
  dataSourceId: DbId<'DataSource'> | undefined,
  pageId: DbId<'DocPage'> | undefined
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (body: { title?: string; content?: string }) => {
      if (!orgId || !dataSourceId || !pageId) return null;
      const res = await api.codeRepos.updateDocPage({
        params: { orgId, dataSourceId, pageId },
        body,
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['code-repos', 'doc-pages', orgId, dataSourceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['code-repos', 'doc-page', orgId, dataSourceId, pageId],
      });
    },
  });

  return { updatePage: mutation.mutate, isUpdating: mutation.isPending };
}
