import { useCallback, useEffect, useState } from 'react';

import type { IntegrationProvider } from '@grabdy/contracts';
import { Box, CircularProgress } from '@mui/material';
import { PlugIcon } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';

import { ConnectionDetailDrawer, IntegrationGrid } from '@/components/integrations';
import type { ConnectionSummary } from '@/components/integrations/IntegrationGrid';
import type { ProviderKey } from '@/components/integrations/ProviderIcon';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/integrations/')({
  component: IntegrationsPage,
});

const ALLOWED_PROVIDERS: readonly string[] = ['SLACK', 'LINEAR'] satisfies readonly IntegrationProvider[];

function isAvailableProvider(
  provider: ProviderKey
): provider is IntegrationProvider {
  return ALLOWED_PROVIDERS.includes(provider);
}

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

  const handleConnect = async (provider: ProviderKey) => {
    if (!selectedOrgId || !isAvailableProvider(provider)) return;
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
    pushDrawer(
      (onClose) => (
        <ConnectionDetailDrawer
          onClose={onClose}
          provider={connection.provider}
          status={connection.status}
          lastSyncedAt={connection.lastSyncedAt}
          syncEnabled={connection.syncEnabled}
          syncIntervalMinutes={connection.syncIntervalMinutes}
          externalAccountName={connection.externalAccountName}
          onRefresh={fetchConnections}
          onConnect={handleConnect}
        />
      ),
      { title: 'Connection Details', mode: 'drawer', width: 480 }
    );
  };

  return (
    <DashboardPage
      title="Integrations"
      subtitle="Connect your tools to search across all your data"
      icon={<PlugIcon size={22} weight="light" color="currentColor" />}
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
