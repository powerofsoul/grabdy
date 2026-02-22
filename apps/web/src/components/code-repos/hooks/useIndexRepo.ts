import type { DbId } from '@grabdy/common';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useIndexRepo(orgId: DbId<'Org'> | undefined) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      repoFullName,
      collectionId,
    }: {
      repoFullName: string;
      collectionId?: DbId<'Collection'>;
    }) => {
      if (!orgId) return null;
      const res = await api.codeRepos.startIndexing({
        params: { orgId },
        body: { repoFullName, collectionId },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return null;
    },
    meta: {
      successMessage: 'Indexing started',
      errorMessage: 'Failed to start indexing',
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['code-repos'] });
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
    },
  });

  return {
    indexRepo: mutation.mutateAsync,
    loading: mutation.isPending,
  };
}
