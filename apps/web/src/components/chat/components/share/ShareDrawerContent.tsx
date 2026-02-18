import { useCallback, useEffect, useState } from 'react';

import type { DbId } from '@grabdy/common';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { CheckIcon, CopyIcon, GlobeIcon, LinkBreakIcon, LockIcon } from '@phosphor-icons/react';
import { z } from 'zod';

import { sharedChatSchema } from '@grabdy/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type SharedChat = z.infer<typeof sharedChatSchema>;

interface ShareDrawerContentProps {
  threadId: DbId<'ChatThread'>;
}

export function ShareDrawerContent({ threadId }: ShareDrawerContentProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const { selectedOrgId } = useAuth();

  const [shares, setShares] = useState<SharedChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchShares = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const res = await api.sharedChats.listShares({
        params: { orgId: selectedOrgId, threadId },
      });
      if (res.status === 200) {
        setShares(res.body.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId, threadId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleCreate = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsCreating(true);
    try {
      const res = await api.sharedChats.createShare({
        params: { orgId: selectedOrgId, threadId },
        body: { isPublic },
      });
      if (res.status === 200) {
        setShares((prev) => [res.body.data, ...prev]);
        const url = `${window.location.origin}/share/${res.body.data.shareToken}`;
        navigator.clipboard.writeText(url);
        setCopiedToken(res.body.data.shareToken);
        setTimeout(() => setCopiedToken(null), 2000);
      }
    } finally {
      setIsCreating(false);
    }
  }, [selectedOrgId, threadId, isPublic]);

  const handleCopy = useCallback((token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }, []);

  const handleRevoke = useCallback(
    async (shareId: DbId<'SharedChat'>) => {
      if (!selectedOrgId) return;
      const res = await api.sharedChats.revokeShare({
        params: { orgId: selectedOrgId, threadId, shareId },
        body: {},
      });
      if (res.status === 200) {
        setShares((prev) =>
          prev.map((s) => (s.id === shareId ? { ...s, revoked: true } : s))
        );
      }
    },
    [selectedOrgId, threadId]
  );

  const activeCount = shares.filter((s) => !s.revoked).length;

  return (
    <Box sx={{ p: 2.5 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography sx={{ fontSize: 13, color: alpha(ct, 0.5), mb: 1.5 }}>
            Create a snapshot link for this conversation. The link captures the current messages
            and canvas state.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                size="small"
              />
            }
            label={<Typography sx={{ fontSize: 13 }}>Anyone with the link can view</Typography>}
            sx={{ mb: 1.5, ml: -0.25 }}
          />
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isCreating}
            fullWidth
            sx={{ fontWeight: 600, fontSize: 13 }}
          >
            {isCreating ? (
              <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
            ) : null}
            Create share link
          </Button>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={20} />
          </Box>
        ) : shares.length > 0 ? (
          <Stack spacing={1}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: alpha(ct, 0.4), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Existing shares ({activeCount} active)
            </Typography>
            {shares.map((share) => (
              <Box
                key={share.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: alpha(ct, 0.03),
                  border: '1px solid',
                  borderColor: alpha(ct, 0.06),
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontFamily: 'monospace',
                        color: share.revoked ? alpha(ct, 0.3) : 'text.primary',
                        textDecoration: share.revoked ? 'line-through' : 'none',
                      }}
                      noWrap
                    >
                      /share/{share.shareToken}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: alpha(ct, 0.4) }}>
                      {share.isPublic ? (
                        <GlobeIcon size={12} weight="light" color="currentColor" />
                      ) : (
                        <LockIcon size={12} weight="light" color="currentColor" />
                      )}
                      <Typography sx={{ fontSize: 11, color: alpha(ct, 0.4) }}>
                        {share.isPublic ? 'Public' : 'Org only'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: alpha(ct, 0.25) }}>·</Typography>
                    <Typography sx={{ fontSize: 11, color: alpha(ct, 0.35) }}>
                      {new Date(share.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
                {share.revoked ? (
                  <Chip label="Revoked" size="small" sx={{ fontSize: 11, height: 22 }} />
                ) : (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={copiedToken === share.shareToken ? 'Copied!' : 'Copy link'}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(share.shareToken)}
                        sx={{ color: alpha(ct, 0.4) }}
                      >
                        {copiedToken === share.shareToken ? (
                          <CheckIcon size={14} weight="light" color="currentColor" />
                        ) : (
                          <CopyIcon size={14} weight="light" color="currentColor" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Revoke link">
                      <IconButton
                        size="small"
                        onClick={() => handleRevoke(share.id)}
                        sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'error.main' } }}
                      >
                        <LinkBreakIcon size={14} weight="light" color="currentColor" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
