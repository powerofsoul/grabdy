import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { DbId } from '@grabdy/common';
import { contract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { KeyIcon, PlusIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { z } from 'zod';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { type DrawerProps, useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/date';
import { FONT_MONO } from '@/theme';

interface ApiKey {
  id: DbId<'ApiKey'>;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const createKeySchema = contract.apiKeys.create.body;
type CreateKeyForm = z.infer<typeof createKeySchema>;

export const Route = createFileRoute('/dashboard/api/keys')({
  component: ApiKeysPage,
});

function CreateKeyDrawer({ onClose, onCreated }: DrawerProps & { onCreated: () => void }) {
  const { selectedOrgId } = useAuth();
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<CreateKeyForm>({
    resolver: zodResolver(createKeySchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: CreateKeyForm) => {
    if (!selectedOrgId) return;
    try {
      const res = await api.apiKeys.create({
        params: { orgId: selectedOrgId },
        body: { name: data.name },
      });
      if (res.status === 200) {
        setNewKeyValue(res.body.data.key);
        reset();
        onCreated();
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to create API key',
      });
    }
  };

  if (newKeyValue) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning">Copy this key now. You will not be able to see it again.</Alert>
        <Box
          sx={{
            fontFamily: FONT_MONO,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            p: 1.5,
            fontSize: '0.85rem',
            wordBreak: 'break-all',
          }}
        >
          <Typography sx={{ flex: 1, fontSize: 'inherit' }}>{newKeyValue}</Typography>
          <CopyButton text={newKeyValue} />
        </Box>
        <Button onClick={onClose} sx={{ alignSelf: 'flex-end' }}>
          Done
        </Button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <TextField
        label="Key Name"
        fullWidth
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
        placeholder="e.g. Production, Development"
        required
        autoFocus
      />
      {errors.root?.message && (
        <Typography color="error" variant="body2">
          {errors.root.message}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
}

function ApiKeysPage() {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const queryClient = useQueryClient();
  const [showRevoked, setShowRevoked] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['apiKeys', selectedOrgId, showRevoked],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await api.apiKeys.list({
        params: { orgId: selectedOrgId },
        query: { includeRevoked: showRevoked },
      });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: !!selectedOrgId,
  });

  const revokeMutation = useMutation({
    mutationFn: async (key: ApiKey) => {
      if (!selectedOrgId) return;
      const res = await api.apiKeys.revoke({
        params: { orgId: selectedOrgId, keyId: key.id },
        body: {},
      });
      if (res.status !== 200) throw new Error('Failed to revoke key');
    },
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
    },
    onSettled: () => setRevokeTarget(null),
  });

  const invalidateKeys = () => {
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
  };

  const openCreateDrawer = () => {
    pushDrawer((onClose) => <CreateKeyDrawer onClose={onClose} onCreated={invalidateKeys} />, {
      title: 'Create API Key',
      mode: 'dialog',
      maxWidth: 'sm',
    });
  };

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => !!k.revokedAt);

  if (isLoading) {
    return (
      <DashboardPage title="API Keys">
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage
      title={`API Keys (${activeKeys.length})`}
      actions={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showRevoked}
                onChange={(_, checked) => setShowRevoked(checked)}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                Show revoked
              </Typography>
            }
            sx={{ mr: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<PlusIcon size={18} weight="light" color="currentColor" />}
            onClick={openCreateDrawer}
          >
            Create Key
          </Button>
        </Box>
      }
    >
      <MainTable
        data={activeKeys}
        headerNames={{
          name: 'Name',
          prefix: 'Key',
          lastUsed: 'Last Used',
          created: 'Created',
          actions: '',
        }}
        columnWidths={{ actions: 80 }}
        rowTitle={(k) => k.name}
        keyExtractor={(k) => k.id}
        renderItems={{
          name: (k) => (
            <Typography variant="body2" fontWeight={500}>
              {k.name}
            </Typography>
          ),
          prefix: (k) => (
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>
              {k.keyPrefix}...
            </Typography>
          ),
          lastUsed: (k) => (
            <Typography variant="body2" color="text.secondary">
              {k.lastUsedAt ? relativeDate(k.lastUsedAt) : 'Never used'}
            </Typography>
          ),
          created: (k) => (
            <Typography variant="body2" color="text.secondary">
              {relativeDate(k.createdAt)}
            </Typography>
          ),
          actions: (k) => (
            <Typography
              component="span"
              onClick={(e) => {
                e.stopPropagation();
                setRevokeTarget(k);
              }}
              sx={{
                fontSize: '0.82rem',
                color: 'error.main',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Revoke
            </Typography>
          ),
        }}
        emptyState={
          <EmptyState
            icon={<KeyIcon size={48} weight="light" color="currentColor" />}
            message="No API keys"
            description="Create an API key to authenticate your requests."
            actionLabel="Create Key"
            onAction={openCreateDrawer}
          />
        }
      />

      {showRevoked && revokedKeys.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Revoked Keys
          </Typography>
          <MainTable
            data={revokedKeys}
            headerNames={{
              name: 'Name',
              prefix: 'Key',
              lastUsed: 'Last Used',
              revokedAt: 'Revoked',
              created: 'Created',
            }}
            rowTitle={(k) => k.name}
            keyExtractor={(k) => k.id}
            renderItems={{
              name: (k) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{ textDecoration: 'line-through', color: 'text.secondary' }}
                  >
                    {k.name}
                  </Typography>
                  <Chip label="Revoked" size="small" color="error" variant="outlined" />
                </Box>
              ),
              prefix: (k) => (
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>
                  {k.keyPrefix}...
                </Typography>
              ),
              lastUsed: (k) => (
                <Typography variant="body2" color="text.secondary">
                  {k.lastUsedAt ? relativeDate(k.lastUsedAt) : 'Never used'}
                </Typography>
              ),
              revokedAt: (k) => (
                <Typography variant="body2" color="text.secondary">
                  {k.revokedAt ? relativeDate(k.revokedAt) : '-'}
                </Typography>
              ),
              created: (k) => (
                <Typography variant="body2" color="text.secondary">
                  {relativeDate(k.createdAt)}
                </Typography>
              ),
            }}
          />
        </Box>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke API Key"
        message={`Are you sure you want to revoke "${revokeTarget?.name}"? Any requests using this key will stop working.`}
        confirmLabel="Revoke"
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget);
        }}
        onCancel={() => setRevokeTarget(null)}
        isLoading={revokeMutation.isPending}
      />
    </DashboardPage>
  );
}
