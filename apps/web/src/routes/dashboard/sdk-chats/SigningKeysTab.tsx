import { useState } from 'react';

import { Box, Button, Typography } from '@mui/material';
import { KeyIcon, PlusIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';

import { GenerateKeyDrawer } from './GenerateKeyDrawer';
import type { SdkChatDetail, SigningKey } from './types';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/date';
import { FONT_MONO } from '@/theme';

export function SigningKeysTab({
  chat,
  onUpdated,
}: {
  chat: SdkChatDetail;
  onUpdated: () => void;
}) {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const [revokeTarget, setRevokeTarget] = useState<SigningKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const activeKeys = chat.signingKeys.filter((k) => !k.revokedAt);

  const openGenerateDrawer = () => {
    if (!selectedOrgId) return;
    pushDrawer(
      (onClose) => (
        <GenerateKeyDrawer
          onClose={onClose}
          onCreated={onUpdated}
          orgId={selectedOrgId}
          sdkChatId={chat.id}
        />
      ),
      { title: 'Generate Signing Key', mode: 'dialog', maxWidth: 'sm' }
    );
  };

  const handleRevoke = async () => {
    if (!selectedOrgId || !revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await api.sdkChats.revokeSigningKey({
        params: { orgId: selectedOrgId, sdkChatId: chat.id, keyId: revokeTarget.id },
        body: {},
      });
      if (res.status === 200) {
        toast.success('Signing key revoked');
        onUpdated();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<PlusIcon size={18} weight="light" color="currentColor" />}
          onClick={openGenerateDrawer}
        >
          Generate Key
        </Button>
      </Box>

      <MainTable
        data={activeKeys}
        headerNames={{
          name: 'Name',
          fingerprint: 'Fingerprint',
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
          fingerprint: (k) => (
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: FONT_MONO }}>
              {k.fingerprint}
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
            message="No signing keys"
            description="Generate a signing key to authenticate your chat widget."
            actionLabel="Generate Key"
            onAction={openGenerateDrawer}
          />
        }
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke Signing Key"
        message={`Are you sure you want to revoke "${revokeTarget?.name}"? JWTs signed with this key will stop working.`}
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
        isLoading={isRevoking}
      />
    </Box>
  );
}
