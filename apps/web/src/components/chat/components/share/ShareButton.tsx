import { useCallback } from 'react';

import type { DbId } from '@grabdy/common';
import { alpha, Badge, IconButton, Tooltip, useTheme } from '@mui/material';
import { ShareNetworkIcon } from '@phosphor-icons/react';

import { ShareDrawerContent } from './ShareDrawerContent';
import { useThreadShares } from './useThreadShares';

import { useDrawer } from '@/context/DrawerContext';

interface ShareButtonProps {
  threadId: DbId<'ChatThread'>;
}

export function ShareButton({ threadId }: ShareButtonProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const { pushDrawer } = useDrawer();

  const { data: shares = [] } = useThreadShares(threadId);
  const activeCount = shares.filter((s) => !s.revoked).length;

  const handleClick = useCallback(() => {
    pushDrawer(() => <ShareDrawerContent threadId={threadId} />, { title: 'Share conversation' });
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
