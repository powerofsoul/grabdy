import { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Key, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export const Route = createFileRoute('/dashboard/api-keys')({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { selectedOrgId } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchKeys = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const res = await api.apiKeys.list({ params: { orgId: selectedOrgId } });
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
  }, [selectedOrgId]);

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
        fetchKeys();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedOrgId || !revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await api.apiKeys.revoke({
        params: { orgId: selectedOrgId, keyId: revokeTarget.id as never },
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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);

  return (
    <DashboardPage
      title="API Keys"
      actions={
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => setDialogOpen(true)}
        >
          Create Key
        </Button>
      }
    >

      {activeKeys.length === 0 ? (
        <EmptyState
          icon={<Key size={48} />}
          message="No API keys"
          description="Create an API key to authenticate your requests."
          actionLabel="Create Key"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeKeys.map((key) => (
            <Card key={key.id}>
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2.5,
                  '&:last-child': { pb: 2.5 },
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {key.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" className="font-mono">
                    {key.keyPrefix}...
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` \u00B7 Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </Typography>
                </Box>
                <Tooltip title="Revoke">
                  <IconButton color="error" size="small" onClick={() => setRevokeTarget(key)}>
                    <Trash2 size={18} />
                  </IconButton>
                </Tooltip>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setNewKeyValue(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{newKeyValue ? 'API Key Created' : 'Create API Key'}</DialogTitle>
        <DialogContent>
          {newKeyValue ? (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Copy this key now. You will not be able to see it again.
              </Alert>
              <Box
                className="font-mono"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  p: 1.5,
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                }}
              >
                <Typography sx={{ flex: 1, fontSize: 'inherit' }}>
                  {newKeyValue}
                </Typography>
                <CopyButton text={newKeyValue} />
              </Box>
            </>
          ) : (
            <TextField
              label="Key Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ mt: 1 }}
              placeholder="e.g. Production, Development"
              required
            />
          )}
        </DialogContent>
        <DialogActions>
          {newKeyValue ? (
            <Button
              onClick={() => {
                setDialogOpen(false);
                setNewKeyValue(null);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={isCreating || !name.trim()}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

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
