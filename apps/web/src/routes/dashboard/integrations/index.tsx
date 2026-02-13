import { useCallback, useEffect, useState } from 'react';

import { CircularProgress, Box } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Plug } from 'lucide-react';
import { toast } from 'sonner';

import type { IntegrationProvider } from '@grabdy/contracts';

import { ConnectionDetailDrawer, IntegrationGrid } from '@/components/integrations';
import type { ConnectionSummary } from '@/components/integrations/IntegrationGrid';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/integrations/')({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.integrations.listConnections({
        params: { orgId: selectedOrgId },
      });
      if (res.status === 200) {
        setConnections(res.body.data);
      }
    } catch {
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleConnect = async (provider: IntegrationProvider) => {
    if (!selectedOrgId) return;
    try {
      const res = await api.integrations.connect({
        params: { orgId: selectedOrgId, provider },
      });
      if (res.status === 200) {
        window.location.href = res.body.data.redirectUrl;
      }
    } catch {
      toast.error('Failed to start connection');
    }
  };

  const handleManage = (_provider: IntegrationProvider, connection: ConnectionSummary) => {
    pushDrawer(ConnectionDetailDrawer, {
      title: 'Connection Details',
      mode: 'drawer',
      width: 480,
      provider: connection.provider,
      status: connection.status,
      lastSyncedAt: connection.lastSyncedAt,
      syncEnabled: connection.syncEnabled,
      syncIntervalMinutes: connection.syncIntervalMinutes,
      externalAccountName: connection.externalAccountName,
      onRefresh: fetchConnections,
    });
  };

  return (
    <DashboardPage
      title="Integrations"
      subtitle="Connect your tools to search across all your data"
      icon={<Plug size={22} />}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (
        <IntegrationGrid
          connections={connections}
          onConnect={handleConnect}
          onManage={handleManage}
        />
      )}
    </DashboardPage>
  );
}
