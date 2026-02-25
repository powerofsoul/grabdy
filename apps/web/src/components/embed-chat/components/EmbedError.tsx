import { alpha, Box, IconButton, Typography, useTheme } from '@mui/material';
import { LockIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';

import { postToParent } from '../types';

export function EmbedError({ variant }: { variant: 'unauthorized' | 'error' }) {
  const theme = useTheme();
  const isUnauth = variant === 'unauthorized';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minHeight: 44,
        }}
      >
        <IconButton
          size="small"
          onClick={() => postToParent({ type: 'CLOSE' })}
          sx={{ color: 'text.secondary' }}
        >
          <XIcon size={18} weight="bold" />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 1.5,
          p: 3,
          textAlign: 'center',
        }}
      >
        {isUnauth ? (
          <LockIcon size={36} weight="light" color={alpha(theme.palette.text.primary, 0.25)} />
        ) : (
          <WarningCircleIcon
            size={36}
            weight="light"
            color={alpha(theme.palette.text.primary, 0.25)}
          />
        )}
        <Typography variant="body2" color="text.secondary">
          {isUnauth
            ? 'Authentication failed. Please check your signing key configuration.'
            : 'Something went wrong. Please try again later.'}
        </Typography>
      </Box>
    </Box>
  );
}
