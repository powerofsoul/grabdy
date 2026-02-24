import { alpha, Typography, useTheme } from '@mui/material';

import { FONT_MONO } from '@/theme';

export function CountBadge({ count }: { count: number }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  return (
    <Typography
      component="span"
      sx={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        fontWeight: 500,
        color: alpha(ct, 0.35),
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count}
    </Typography>
  );
}
