import { useEffect, useState } from 'react';

import type { IntegrationProvider } from '@grabdy/contracts';

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
  const [collections, setCollections] = useState<SidebarCollection[]>([]);
  const [connections, setConnections] = useState<SidebarConnection[]>([]);

  useEffect(() => {
    if (!selectedOrgId) return;

    let cancelled = false;

    const fetchCollections = async () => {
      try {
        const res = await api.collections.list({ params: { orgId: selectedOrgId } });
        if (res.status === 200 && !cancelled) {
          setCollections(
            res.body.data.map((c: { id: string; name: string; sourceCount: number }) => ({
              id: c.id,
              name: c.name,
              sourceCount: c.sourceCount,
            }))
          );
        }
      } catch {
        // keep empty
      }
    };

    const fetchConnections = async () => {
      try {
        const res = await api.integrations.listConnections({ params: { orgId: selectedOrgId } });
        if (res.status === 200 && !cancelled) {
          setConnections(
            res.body.data
              .filter((c) => c.status === 'ACTIVE')
              .map((c) => ({
                id: c.id,
                provider: c.provider,
                name: c.externalAccountName ?? c.provider,
              }))
          );
        }
      } catch {
        // keep empty
      }
    };

    fetchCollections();
    fetchConnections();

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  return { collections, connections };
}
