import { useState } from 'react';

import { integrationProviderEnum } from '@grabdy/contracts';
import { Box, Button, Typography, useTheme } from '@mui/material';
import {
  ClockIcon,
  DatabaseIcon,
  PlugIcon,
  PlugsConnectedIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { getProviderLabel, ProviderIcon } from '@/components/integrations';
import {
  formatRelativeTime,
  ResourcePicker,
  Section,
  StatusChip,
  SyncGuide,
} from '@/components/integrations/provider-detail';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/integrations/$provider')({
  component: IntegrationDetailPage,
});

function IntegrationDetailPage() {
  const { provider: rawProvider } = Route.useParams();
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();

  const parsed = integrationProviderEnum.safeParse(rawProvider.toUpperCase());
  const provider = parsed.success ? parsed.data : null;

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
    enabled: !!selectedOrgId && !!provider,
  });

  const connection = connections?.find((c) => c.provider === provider) ?? null;

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDisconnected = connection?.status === 'DISCONNECTED';
  const isActive = connection?.status === 'ACTIVE';

  const refreshConnections = () => {
    queryClient.invalidateQueries({ queryKey: ['integrations', 'connections'] });
  };

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId || !provider) throw new Error('Missing context');
      const res = await api.integrations.connect({
        params: { orgId: selectedOrgId, provider },
      });
      if (res.status !== 200) throw new Error('Failed to start connection');
      return res.body.data.redirectUrl;
    },
    onSuccess: (redirectUrl) => {
      window.location.assign(redirectUrl);
    },
    onError: () => {
      toast.error('Failed to start connection');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId || !provider) throw new Error('Missing context');
      const res = await api.integrations.disconnect({
        params: { orgId: selectedOrgId, provider },
        body: {},
      });
      if (res.status !== 200) throw new Error('Failed to disconnect');
    },
    onSuccess: () => {
      toast.success(`${provider ? getProviderLabel(provider) : 'Integration'} disconnected`);
      setConfirmDisconnect(false);
      refreshConnections();
    },
    onError: () => {
      toast.error('Failed to disconnect');
      setConfirmDisconnect(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId || !provider) throw new Error('Missing context');
      const res = await api.integrations.deleteConnection({
        params: { orgId: selectedOrgId, provider },
        body: {},
      });
      if (res.status !== 200) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast.success(`${provider ? getProviderLabel(provider) : 'Integration'} data deleted`);
      setConfirmDelete(false);
      refreshConnections();
      navigate({ to: '/dashboard/integrations' });
    },
    onError: () => {
      toast.error('Failed to delete data');
      setConfirmDelete(false);
    },
  });

  if (!provider) {
    return (
      <DashboardPage title="Integration" showBack>
        <Typography variant="body2" color="text.secondary">
          Unknown integration provider.
        </Typography>
      </DashboardPage>
    );
  }

  const providerLabel = getProviderLabel(provider);

  if (isLoading) {
    return (
      <DashboardPage
        title={providerLabel}
        showBack
        icon={<ProviderIcon provider={provider} size={22} />}
      >
        <PageLoader />
      </DashboardPage>
    );
  }

  if (!connection) {
    return (
      <DashboardPage
        title={providerLabel}
        showBack
        icon={<ProviderIcon provider={provider} size={22} />}
      >
        <Box
          sx={{
            maxWidth: 480,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            py: 4,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {providerLabel} is not connected yet. Connect to start syncing your data.
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<PlugIcon size={15} weight="light" />}
            onClick={() => connectMutation.mutate()}
            sx={{ borderRadius: 1.5 }}
          >
            Connect {providerLabel}
          </Button>
        </Box>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title={providerLabel}
      showBack
      icon={<ProviderIcon provider={provider} size={22} />}
    >
      <Box
        sx={{
          maxWidth: provider === 'GITHUB' ? 720 : 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Section title="Overview">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {connection.externalAccountName && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Account
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {connection.externalAccountName}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Status
              </Typography>
              <StatusChip status={connection.status} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Items synced
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <DatabaseIcon size={14} weight="light" color={theme.palette.text.secondary} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {connection.dataSourceCount.toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Last synced
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <ClockIcon size={14} weight="light" color={theme.palette.text.secondary} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {connection.lastSyncedAt ? formatRelativeTime(connection.lastSyncedAt) : 'Never'}
                </Typography>
              </Box>
            </Box>

            {connection.syncScheduleLabel && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Schedule
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {connection.syncScheduleLabel}
                </Typography>
              </Box>
            )}
          </Box>
        </Section>

        {isActive && <SyncGuide provider={provider} />}

        {(provider === 'SLACK' || provider === 'GITHUB') && isActive && selectedOrgId && (
          <ResourcePicker
            provider={provider}
            orgId={selectedOrgId}
            onRefresh={refreshConnections}
          />
        )}

        <Section title={isDisconnected ? 'Actions' : 'Danger Zone'}>
          {isDisconnected ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                This integration has been disconnected. Your synced data is still available for
                search.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<PlugsConnectedIcon size={15} weight="light" color="currentColor" />}
                  onClick={() => connectMutation.mutate()}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  Reconnect
                </Button>
                {!confirmDelete ? (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<TrashIcon size={15} weight="light" color="currentColor" />}
                    onClick={() => setConfirmDelete(true)}
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  >
                    Delete Data
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Disconnecting will stop syncing new data. Existing data remains searchable. You can
                delete all synced data after disconnecting.
              </Typography>
              {provider === 'NOTION' && (
                <Typography variant="caption" color="warning.main">
                  Notion does not support automatic removal. After disconnecting, you will also need
                  to remove Grabdy from your Notion integrations settings manually.
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {!confirmDisconnect ? (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<PlugsConnectedIcon size={15} weight="light" color="currentColor" />}
                    onClick={() => setConfirmDisconnect(true)}
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  >
                    {disconnectMutation.isPending ? 'Disconnecting...' : 'Confirm Disconnect'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Section>
      </Box>
    </DashboardPage>
  );
}
