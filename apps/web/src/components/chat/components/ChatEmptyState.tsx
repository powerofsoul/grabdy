import { alpha, Avatar, Box, Typography, useTheme } from '@mui/material';

import svg3 from '@/assets/watermarks/svg-3.svg';

interface ChatEmptyStateProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  primaryColor?: string;
}

export function ChatEmptyState({ title, subtitle, imageUrl, primaryColor }: ChatEmptyStateProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        position: 'relative',
      }}
    >
      {imageUrl ? (
        <Avatar src={imageUrl} sx={{ width: 80, height: 80, mb: 1 }} />
      ) : (
        <Box
          component="img"
          src={svg3}
          alt=""
          sx={{
            width: 320,
            height: 'auto',
            ml: '45px',
            opacity: theme.palette.mode === 'dark' ? 0.05 : 0.08,
            mixBlendMode: theme.palette.mode === 'dark' ? 'screen' : 'multiply',
            filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
            mb: -2,
            pointerEvents: 'none',
          }}
        />
      )}

      <Typography variant="h4" sx={primaryColor ? { color: primaryColor } : undefined}>
        {title ?? 'Your documents await'}
      </Typography>
      <Typography sx={{ color: alpha(ct, 0.4), fontSize: 14 }}>
        {subtitle ?? "Ask anything. They don't bite."}
      </Typography>
    </Box>
  );
}
