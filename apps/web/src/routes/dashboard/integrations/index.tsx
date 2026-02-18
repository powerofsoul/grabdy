import { useCallback, useEffect, useRef, useState } from 'react';

import type { IntegrationProvider } from '@grabdy/contracts';
import { integrationProviderEnum } from '@grabdy/contracts';
import { Box, CircularProgress } from '@mui/material';
import { PlugIcon } from '@phosphor-icons/react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConnectionDetailDrawer, IntegrationGrid } from '@/components/integrations';
import type { ConnectionSummary } from '@/components/integrations/IntegrationGrid';
import type { ProviderKey } from '@/components/integrations/ProviderIcon';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

const integrationsSearchSchema = z.object({
  connected: integrationProviderEnum.optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute('/dashboard/integrations/')({
  component: IntegrationsPage,
  validateSearch: integrationsSearchSchema,
});

const ALLOWED_PROVIDERS: readonly string[] = [
  'SLACK',
  'LINEAR',
  'GITHUB',
] satisfies readonly IntegrationProvider[];

function isAvailableProvider(provider: ProviderKey): provider is IntegrationProvider {
  return ALLOWED_PROVIDERS.includes(provider);
}

function IntegrationsPage() {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const navigate = useNavigate();
  const { connected, error } = useSearch({ from: '/dashboard/integrations/' });
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const autoOpenedRef = useRef(false);

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

  const handleConnect = useCallback(
    async (provider: ProviderKey) => {
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
    },
    [selectedOrgId]
  );

  const openDrawer = useCallback(
    (connection: ConnectionSummary) => {
      pushDrawer(
        (onClose) => (
          <ConnectionDetailDrawer
            onClose={onClose}
            provider={connection.provider}
            status={connection.status}
            lastSyncedAt={connection.lastSyncedAt}
            externalAccountName={connection.externalAccountName}
            syncScheduleLabel={connection.syncScheduleLabel}
            onRefresh={fetchConnections}
            onConnect={handleConnect}
          />
        ),
        { title: 'Connection Details', mode: 'drawer', width: 480 }
      );
    },
    [pushDrawer, fetchConnections, handleConnect]
  );

  const handleManage = useCallback(
    (_provider: IntegrationProvider, connection: ConnectionSummary) => {
      openDrawer(connection);
    },
    [openDrawer]
  );

  useEffect(() => {
    if (error) {
      toast.error(`Connection failed: ${error}`);
      navigate({ to: '/dashboard/integrations', search: {}, replace: true });
    }
  }, [error, navigate]);

  // Auto-open the drawer after a successful OAuth callback
  useEffect(() => {
    if (!connected || loading || autoOpenedRef.current) return;
    const connection = connections.find((c) => c.provider === connected);
    if (!connection) return;
    autoOpenedRef.current = true;
    navigate({ to: '/dashboard/integrations', search: {}, replace: true });
    toast.success(`${connected} connected`);
    openDrawer(connection);
  }, [connected, loading, connections, navigate, openDrawer]);

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
