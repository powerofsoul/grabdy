import type { DbId } from '@grabdy/common';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useContract(contractId: DbId<'Contract'>) {
  const { selectedOrgId } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['contract', contractId, selectedOrgId],
    queryFn: () =>
      api.contracts.get({
        params: { orgId: selectedOrgId ?? '', contractId },
      }),
    enabled: !!selectedOrgId,
  });

  const contract = data?.status === 200 ? data.body.data : undefined;

  return { contract, isLoading, error };
}
