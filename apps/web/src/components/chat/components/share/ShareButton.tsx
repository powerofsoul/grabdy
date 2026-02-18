import { useCallback, useEffect, useState } from 'react';

import type { DbId } from '@grabdy/common';
import { alpha, Badge, IconButton, Tooltip, useTheme } from '@mui/material';
import { ShareNetworkIcon } from '@phosphor-icons/react';

import { useDrawer } from '@/context/DrawerContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

import { ShareDrawerContent } from './ShareDrawerContent';

interface ShareButtonProps {
  threadId: DbId<'ChatThread'>;
}

export function ShareButton({ threadId }: ShareButtonProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const { pushDrawer } = useDrawer();
  const { selectedOrgId } = useAuth();
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    if (!selectedOrgId) return;
    api.sharedChats
      .listShares({ params: { orgId: selectedOrgId, threadId } })
      .then((res) => {
        if (res.status === 200) {
          setActiveCount(res.body.data.filter((s) => !s.revoked).length);
        }
      })
      .catch(() => {});
  }, [selectedOrgId, threadId]);

  const handleClick = useCallback(() => {
    pushDrawer(
      () => <ShareDrawerContent threadId={threadId} />,
      { title: 'Share conversation' }
    );
  }, [pushDrawer, threadId]);

  return (
    <Tooltip title="Share">
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{ color: alpha(ct, 0.4), '&:hover': { color: 'text.primary' } }}
      >
        <Badge
          badgeContent={activeCount}
          color="primary"
          sx={{
            '& .MuiBadge-badge': {
              fontSize: 10,
              height: 16,
              minWidth: 16,
              padding: '0 4px',
            },
          }}
        >
          <ShareNetworkIcon size={18} weight="light" color="currentColor" />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
