import type { DbId } from '@grabdy/common';
import type { IntegrationProvider } from '@grabdy/contracts';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface SidebarConnection {
  id: string;
  provider: IntegrationProvider;
  name: string;
}

interface SidebarBot {
  id: DbId<'Bot'>;
  name: string;
}

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

  const { data: bots = [] } = useQuery<SidebarBot[]>({
    queryKey: ['bots', selectedOrgId, 'sidebar'],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.bots.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) {
        return res.body.data.map((c) => ({ id: c.id, name: c.name }));
      }
      return [];
    },
    enabled: !!selectedOrgId,
  });

  return { connections, bots };
}
