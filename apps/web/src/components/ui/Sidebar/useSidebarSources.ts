import type { IntegrationProvider } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface SidebarCollection {
  id: string;
  name: string;
  sourceCount: number;
}

interface SidebarConnection {
  id: string;
  provider: IntegrationProvider;
  name: string;
}

export function useSidebarSources() {
  const { selectedOrgId } = useAuth();

  const { data: collections = [] } = useQuery<SidebarCollection[]>({
    queryKey: ['collections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.collections.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) {
        return res.body.data.map((c: { id: string; name: string; sourceCount: number }) => ({
          id: c.id,
          name: c.name,
          sourceCount: c.sourceCount,
        }));
      }
      return [];
    },
    enabled: !!selectedOrgId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['integrations', 'connections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.integrations.listConnections({ params: { orgId: selectedOrgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
    select: (data): SidebarConnection[] =>
      data
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({
          id: c.id,
          provider: c.provider,
          name: c.externalAccountName ?? c.provider,
        })),
  });

  return { collections, connections };
}
