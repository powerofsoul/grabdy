import { useEffect, useState } from 'react';

import type { DbId } from '@grabdy/common';
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
import { createFileRoute } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { Key, Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { type DrawerProps, useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';

interface ApiKey {
  id: DbId<'ApiKey'>;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export const Route = createFileRoute('/dashboard/api/keys')({
  component: ApiKeysPage,
});

function relativeDate(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function CreateKeyDrawer({ onClose, onCreated }: DrawerProps & { onCreated: () => void }) {
  const { selectedOrgId } = useAuth();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedOrgId || !name.trim()) return;
    setIsCreating(true);
    try {
      const res = await api.apiKeys.create({
        params: { orgId: selectedOrgId },
        body: { name: name.trim() },
      });
      if (res.status === 200) {
        setNewKeyValue(res.body.data.key);
        setName('');
        onCreated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  if (newKeyValue) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning">Copy this key now. You will not be able to see it again.</Alert>
        <Box
          className="font-mono"
          sx={{
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
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Key Name"
        fullWidth
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Production, Development"
        required
        autoFocus
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={isCreating || !name.trim()}>
          {isCreating ? 'Creating...' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
}

function ApiKeysPage() {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRevoked, setShowRevoked] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchKeys = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const res = await api.apiKeys.list({
        params: { orgId: selectedOrgId },
        query: { includeRevoked: showRevoked },
      });
      if (res.status === 200) {
        setKeys(res.body.data);
      }
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [selectedOrgId, showRevoked]);

  const openCreateDrawer = () => {
    pushDrawer(CreateKeyDrawer, {
      title: 'Create API Key',
      mode: 'dialog',
      maxWidth: 'sm',
      onCreated: () => {
        fetchKeys();
      },
    });
  };

  const handleRevoke = async () => {
    if (!selectedOrgId || !revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await api.apiKeys.revoke({
        params: { orgId: selectedOrgId, keyId: revokeTarget.id },
        body: {},
      });
      if (res.status === 200) {
        toast.success('API key revoked');
        fetchKeys();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
    }
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
          <Button variant="contained" startIcon={<Plus size={18} weight="light" color="currentColor" />} onClick={openCreateDrawer}>
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
            <Typography variant="body2" color="text.secondary" className="font-mono">
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
            icon={<Key size={48} weight="light" color="currentColor" />}
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
                <Typography variant="body2" color="text.secondary" className="font-mono">
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
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
        isLoading={isRevoking}
      />
    </DashboardPage>
  );
}
