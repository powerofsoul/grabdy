import { useState } from 'react';

import { Box, CircularProgress, MenuItem, TextField } from '@mui/material';
import { ChatCircleDotsIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { DeveloperDocs } from './bots/DeveloperDocs';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export const Route = createFileRoute('/dashboard/sdk-developer')({
  component: SdkDeveloperPage,
});

function SdkDeveloperPage() {
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();
  const [selectedChatId, setSelectedChatId] = useState<string>('');

  const { data: chats, isLoading } = useQuery({
    queryKey: ['bots', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.bots.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  // Auto-select first chat when data arrives
  const items = chats ?? [];
  const resolvedChatId = selectedChatId || (items.length > 0 ? items[0].id : '');

  if (isLoading) {
    return (
      <DashboardPage title="SDK Developer Docs" maxWidth={800}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </DashboardPage>
    );
  }

  if (items.length === 0) {
    return (
      <DashboardPage title="SDK Developer Docs" maxWidth={800}>
        <EmptyState
          icon={<ChatCircleDotsIcon size={48} weight="light" color="currentColor" />}
          message="No Bots"
          description="Create a Bot first to see integration docs with your Chat ID."
          actionLabel="Go to Bots"
          onAction={() => {
            void navigate({ to: '/dashboard/bots' });
          }}
        />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title="SDK Developer Docs" maxWidth={800}>
      {items.length > 1 && (
        <TextField
          select
          label="Bot"
          value={resolvedChatId}
          onChange={(e) => setSelectedChatId(e.target.value)}
          size="small"
          sx={{ mb: 3, minWidth: 280 }}
        >
          {items.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      )}

      <DeveloperDocs botId={resolvedChatId} />
    </DashboardPage>
  );
}
