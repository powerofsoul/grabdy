import { useState } from 'react';

import { Box, CircularProgress, FormControlLabel, Switch, Tab, Tabs } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';

import { DeveloperDocs } from './DeveloperDocs';
import { SettingsTab } from './SettingsTab';
import { SigningKeysTab } from './SigningKeysTab';
import { useSdkPreview } from './useSdkPreview';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/sdk-chats/$sdkChatId')({
  component: SdkChatDetailPage,
});

function SdkChatDetailPage() {
  const { selectedOrgId } = useAuth();
  const { sdkChatId } = Route.useParams();
  const queryClient = useQueryClient();
  const [tabIndex, setTabIndex] = useState(0);

  const queryKey = ['sdk-chat', selectedOrgId, sdkChatId];

  const { data: chat, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.sdkChats.get({
        params: { orgId: selectedOrgId, sdkChatId },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedOrgId,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!selectedOrgId || !chat) return;
      await api.sdkChats.update({
        params: { orgId: selectedOrgId, sdkChatId: chat.id },
        body: { isActive },
      });
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(isActive ? 'Chat activated' : 'Chat deactivated');
    },
  });

  const invalidateChat = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  // Mount the actual SDK bubble at the page level
  useSdkPreview(chat?.id, selectedOrgId);

  if (isLoading || !chat) {
    return (
      <DashboardPage title="SDK Chat" showBack>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title={chat.name}
      showBack
      actions={
        <FormControlLabel
          control={
            <Switch
              checked={chat.isActive}
              onChange={(_, checked) => toggleActiveMutation.mutate(checked)}
              size="small"
            />
          }
          label={chat.isActive ? 'Active' : 'Inactive'}
          sx={{ mr: 0 }}
        />
      }
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabIndex} onChange={(_, v: number) => setTabIndex(v)}>
          <Tab label="Settings" />
          <Tab label="Signing Keys" />
          <Tab label="Integration" />
        </Tabs>
      </Box>

      {tabIndex === 0 && <SettingsTab chat={chat} onUpdated={invalidateChat} />}
      {tabIndex === 1 && <SigningKeysTab chat={chat} onUpdated={invalidateChat} />}
      {tabIndex === 2 && <DeveloperDocs chatId={chat.id} />}
    </DashboardPage>
  );
}
