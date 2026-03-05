import { useState } from 'react';

import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { CopyIcon, KeyIcon, PlusIcon } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { GenerateKeyDrawer } from './GenerateKeyDrawer';
import type { BotDetail, SigningKey } from './types';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { useDrawer } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/date';
import { FONT_MONO } from '@/theme';

export function SigningKeysTab({ bot, onUpdated }: { bot: BotDetail; onUpdated: () => void }) {
  const { selectedOrgId } = useAuth();
  const { pushDrawer } = useDrawer();
  const [revokeTarget, setRevokeTarget] = useState<SigningKey | null>(null);

  const activeKeys = bot.signingKeys.filter((k) => !k.revokedAt);

  const openGenerateDrawer = () => {
    if (!selectedOrgId) return;
    pushDrawer(
      (onClose) => (
        <GenerateKeyDrawer
          onClose={onClose}
          onCreated={onUpdated}
          orgId={selectedOrgId}
          botId={bot.id}
        />
      ),
      { title: 'Generate Signing Key', mode: 'dialog', maxWidth: 'sm' }
    );
  };

  const revokeMutation = useMutation({
    mutationFn: async (target: SigningKey) => {
      if (!selectedOrgId) return;
      const res = await api.bots.revokeSigningKey({
        params: { orgId: selectedOrgId, botId: bot.id, keyId: target.id },
        body: {},
      });
      if (res.status !== 200) throw new Error('Failed to revoke key');
    },
    onSuccess: () => {
      toast.success('Signing key revoked');
      onUpdated();
      setRevokeTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke key');
      setRevokeTarget(null);
    },
  });

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
        columnWidths={{ name: 100, actions: 80, created: 120 }}
        rowTitle={(k) => k.name}
        keyExtractor={(k) => k.id}
        renderItems={{
          name: (k) => (
            <Typography variant="body2" fontWeight={500}>
              {k.name}
            </Typography>
          ),
          fingerprint: (k) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontFamily: FONT_MONO,
                  wordBreak: 'break-all',
                }}
              >
                {k.fingerprint}
              </Typography>
              <Tooltip title="Copy fingerprint">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(k.fingerprint);
                    toast.success('Fingerprint copied');
                  }}
                  sx={{ flexShrink: 0 }}
                >
                  <CopyIcon size={16} weight="light" />
                </IconButton>
              </Tooltip>
            </Box>
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
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget);
        }}
        onCancel={() => setRevokeTarget(null)}
        isLoading={revokeMutation.isPending}
      />
    </Box>
  );
}
