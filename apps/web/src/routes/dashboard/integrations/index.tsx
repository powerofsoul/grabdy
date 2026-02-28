import { useCallback, useEffect, useRef } from 'react';

import type { IntegrationProvider } from '@grabdy/contracts';
import { integrationProviderEnum } from '@grabdy/contracts';
import { PlugIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import type { ProviderKey } from '@/components/integrations';
import { IntegrationGrid } from '@/components/integrations';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';
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
  'NOTION',
] satisfies readonly IntegrationProvider[];

function isAvailableProvider(provider: ProviderKey): provider is IntegrationProvider {
  return ALLOWED_PROVIDERS.includes(provider);
}

function IntegrationsPage() {
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const { connected, error } = useSearch({ from: '/dashboard/integrations/' });
  const autoOpenedRef = useRef(false);

  const { data: connections, isLoading } = useQuery({
    queryKey: ['integrations', 'connections', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.integrations.listConnections({
        params: { orgId: selectedOrgId },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

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

  const handleManage = useCallback(
    (provider: IntegrationProvider) => {
      navigate({
        to: '/dashboard/integrations/$provider',
        params: { provider: provider.toLowerCase() },
      });
    },
    [navigate]
  );

  useEffect(() => {
    if (error) {
      toast.error(`Connection failed: ${error}`);
      navigate({ to: '/dashboard/integrations', search: {}, replace: true });
    }
  }, [error, navigate]);

  // After successful OAuth callback, navigate to provider detail page
  useEffect(() => {
    if (!connected || isLoading || autoOpenedRef.current) return;
    const connection = connections?.find((c) => c.provider === connected);
    if (!connection) return;
    autoOpenedRef.current = true;
    toast.success(`${connected} connected`);
    navigate({
      to: '/dashboard/integrations/$provider',
      params: { provider: connected.toLowerCase() },
      replace: true,
    });
  }, [connected, isLoading, connections, navigate]);

  return (
    <DashboardPage
      title="Integrations"
      subtitle="Connect your tools to search across all your data"
      icon={<PlugIcon size={22} weight="light" color="currentColor" />}
    >
      {isLoading ? (
        <PageLoader />
      ) : (
        <IntegrationGrid
          connections={connections ?? []}
          onConnect={handleConnect}
          onManage={handleManage}
        />
      )}
    </DashboardPage>
  );
}
