import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useSidebarSources() {
  const { selectedOrgId } = useAuth();

  // Prime the collections cache for SourcesTreePanel and other consumers
  useQuery({
    queryKey: ['collections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.collections.list({ params: { orgId: selectedOrgId }, query: {} });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });
}
