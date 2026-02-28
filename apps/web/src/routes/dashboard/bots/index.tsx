import { useState } from 'react';

import type { DbId } from '@grabdy/common';
import { Button, Typography } from '@mui/material';
import { ChatCircleIcon, PlusIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { CreateBotDrawer } from './CreateBotDrawer';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/date';

interface Bot {
  id: DbId<'Bot'>;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const Route = createFileRoute('/dashboard/bots/')({
  component: BotsPage,
});

function BotsPage() {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null);

  const { data: bots, isLoading } = useQuery({
    queryKey: ['bots', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.bots.list({ params: { orgId: selectedOrgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: Bot) => {
      if (!selectedOrgId) return;
      const res = await api.bots.delete({
        params: { orgId: selectedOrgId, botId: target.id },
        body: {},
      });
      if (res.status !== 200) throw new Error('Failed to delete Bot');
    },
    onSuccess: () => {
      toast.success('Bot deleted');
      queryClient.invalidateQueries({ queryKey: ['bots', selectedOrgId] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete Bot');
      setDeleteTarget(null);
    },
  });

  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ['bots', selectedOrgId] });
  };

  const openCreateDrawer = () => {
    pushDrawer((onClose) => <CreateBotDrawer onClose={onClose} onCreated={invalidateList} />, {
      title: 'Create Bot',
      mode: 'dialog',
      maxWidth: 'sm',
    });
  };

  const items = bots ?? [];

  if (isLoading) {
    return (
      <DashboardPage title="Bots">
        <PageLoader />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title="Bots"
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
          created: 'Created',
          actions: '',
        }}
        columnWidths={{ actions: 80 }}
        rowTitle={(c) => c.name}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => {
          navigate({ to: '/dashboard/bots/$botId', params: { botId: c.id } });
        }}
        renderItems={{
          name: (c) => (
            <Typography variant="body2" fontWeight={500}>
              {c.name}
            </Typography>
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
            message="No Bots"
            description="Create a bot to embed a chatbot on your website."
            actionLabel="Create Bot"
            onAction={openCreateDrawer}
          />
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Bot"
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
