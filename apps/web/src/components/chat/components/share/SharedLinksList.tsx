import { useCallback, useState } from 'react';

import type { DbId } from '@grabdy/common';
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ChatCircleIcon,
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  LinkBreakIcon,
  LockIcon,
} from '@phosphor-icons/react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const PAGE_SIZE = 20;

interface SharedLinksListProps {
  onOpenThread: (threadId: DbId<'ChatThread'>) => void;
}

export function SharedLinksList({ onOpenThread }: SharedLinksListProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [pages, setPages] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sharedLinks', selectedOrgId, pages],
    queryFn: async () => {
      if (!selectedOrgId) return { shares: [], total: 0 };
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) =>
          api.sharedChats.listAllShares({
            params: { orgId: selectedOrgId },
            query: { limit: PAGE_SIZE, offset: i * PAGE_SIZE },
          })
        )
      );
      const shares = results.flatMap((res) => (res.status === 200 ? res.body.data : []));
      const total = results[0]?.status === 200 ? results[0].body.total : 0;
      return { shares, total };
    },
    enabled: !!selectedOrgId,
    placeholderData: keepPreviousData,
  });

  const shares = data?.shares ?? [];
  const total = data?.total ?? 0;
  const hasMore = shares.length < total;

  const revokeMutation = useMutation({
    mutationFn: async ({
      threadId,
      shareId,
    }: {
      threadId: DbId<'ChatThread'>;
      shareId: DbId<'SharedChat'>;
    }) => {
      if (!selectedOrgId) return;
      await api.sharedChats.revokeShare({
        params: { orgId: selectedOrgId, threadId, shareId },
        body: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedLinks', selectedOrgId] });
      queryClient.invalidateQueries({ queryKey: ['threadShares', selectedOrgId] });
    },
  });

  const handleCopy = useCallback((token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (shares.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, color: alpha(ct, 0.4) }}>No shared links yet</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
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
            <Typography
              noWrap
              sx={{
                fontSize: 13,
                color: share.revoked ? alpha(ct, 0.3) : 'text.primary',
                textDecoration: share.revoked ? 'line-through' : 'none',
              }}
            >
              {share.title ?? 'Untitled'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  color: alpha(ct, 0.4),
                }}
              >
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
              <Tooltip title="Open thread">
                <IconButton
                  size="small"
                  onClick={() => onOpenThread(share.threadId)}
                  sx={{ color: alpha(ct, 0.4) }}
                >
                  <ChatCircleIcon size={14} weight="light" color="currentColor" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Revoke">
                <IconButton
                  size="small"
                  onClick={() =>
                    revokeMutation.mutate({ threadId: share.threadId, shareId: share.id })
                  }
                  sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'error.main' } }}
                >
                  <LinkBreakIcon size={14} weight="light" color="currentColor" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      ))}
      {hasMore && (
        <Button
          variant="text"
          onClick={() => setPages((prev) => prev + 1)}
          sx={{ fontSize: 12, color: alpha(ct, 0.5), textTransform: 'none' }}
        >
          Load more ({total - shares.length} remaining)
        </Button>
      )}
    </Stack>
  );
}
