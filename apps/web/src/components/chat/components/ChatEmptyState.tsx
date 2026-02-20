import { alpha, Box, Typography, useTheme } from '@mui/material';

import svg3 from '@/assets/watermarks/svg-3.svg';

export function ChatEmptyState() {
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
      {/* Watermark SVG */}
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

      <Typography variant="h4">Your documents await</Typography>
      <Typography sx={{ color: alpha(ct, 0.4), fontSize: 14 }}>
        Ask anything — they don&apos;t bite.
      </Typography>
    </Box>
  );
}
