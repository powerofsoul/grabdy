import { useState } from 'react';

import type { DbId } from '@grabdy/common';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { ChatCircleIcon, PlusIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { CreateSdkChatDrawer } from './CreateSdkChatDrawer';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/date';

interface SdkChat {
  id: DbId<'SdkChat'>;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const Route = createFileRoute('/dashboard/sdk-chats/')({
  component: SdkChatsPage,
});

function SdkChatsPage() {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<SdkChat | null>(null);

  const { data: chats, isLoading } = useQuery({
    queryKey: ['sdk-chats', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.sdkChats.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: SdkChat) => {
      if (!selectedOrgId) return;
      const res = await api.sdkChats.delete({
        params: { orgId: selectedOrgId, sdkChatId: target.id },
        body: {},
      });
      if (res.status !== 200) throw new Error('Failed to delete SDK Chat');
    },
    onSuccess: () => {
      toast.success('SDK Chat deleted');
      queryClient.invalidateQueries({ queryKey: ['sdk-chats', selectedOrgId] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete SDK Chat');
      setDeleteTarget(null);
    },
  });

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ['sdk-chats', selectedOrgId] });
  };

  const openCreateDrawer = () => {
    pushDrawer((onClose) => <CreateSdkChatDrawer onClose={onClose} onCreated={invalidateList} />, {
      title: 'Create SDK Chat',
      mode: 'dialog',
      maxWidth: 'sm',
    });
  };

  const items = chats ?? [];

  if (isLoading) {
    return (
      <DashboardPage title="SDK Chats">
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title={`SDK Chats (${items.length})`}
      actions={
        <Button
          variant="contained"
          startIcon={<PlusIcon size={18} weight="light" color="currentColor" />}
          onClick={openCreateDrawer}
        >
          Create
        </Button>
      }
    >
      <MainTable
        data={items}
        headerNames={{
          name: 'Name',
          status: 'Status',
          created: 'Created',
          actions: '',
        }}
        columnWidths={{ status: 100, actions: 80 }}
        rowTitle={(c) => c.name}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => {
          navigate({ to: '/dashboard/sdk-chats/$sdkChatId', params: { sdkChatId: c.id } });
        }}
        renderItems={{
          name: (c) => (
            <Typography variant="body2" fontWeight={500}>
              {c.name}
            </Typography>
          ),
          status: (c) => (
            <Chip
              label={c.isActive ? 'Active' : 'Inactive'}
              size="small"
              color={c.isActive ? 'success' : 'default'}
              variant="outlined"
            />
          ),
          created: (c) => (
            <Typography variant="body2" color="text.secondary">
              {relativeDate(c.createdAt)}
            </Typography>
          ),
          actions: (c) => (
            <Typography
              component="span"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(c);
              }}
              sx={{
                fontSize: '0.82rem',
                color: 'error.main',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Delete
            </Typography>
          ),
        }}
        emptyState={
          <EmptyState
            icon={<ChatCircleIcon size={48} weight="light" color="currentColor" />}
            message="No SDK Chats"
            description="Create an SDK Chat to embed a chatbot on your website."
            actionLabel="Create SDK Chat"
            onAction={openCreateDrawer}
          />
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete SDK Chat"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMutation.isPending}
      />
    </DashboardPage>
  );
}
