import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface SidebarCollection {
  id: string;
  name: string;
  sourceCount: number;
}

export function useSidebarCollections() {
  const { selectedOrgId } = useAuth();
  const [collections, setCollections] = useState<SidebarCollection[]>([]);

  useEffect(() => {
    if (!selectedOrgId) return;

    let cancelled = false;

    const fetch = async () => {
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

    fetch();

    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  return collections;
}
