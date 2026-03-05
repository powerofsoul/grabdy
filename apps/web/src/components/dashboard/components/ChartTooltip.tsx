import { Box, Typography, useTheme } from '@mui/material';

import { FONT_MONO } from '@/theme';

export function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  const theme = useTheme();
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        px: 1.5,
        py: 0.75,
        boxShadow: theme.shadows[2],
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{item.name}</Typography>
      <Typography sx={{ fontSize: 12, fontFamily: FONT_MONO, color: 'text.secondary' }}>
        {item.value} contract{item.value === 1 ? '' : 's'}
      </Typography>
    </Box>
  );
}
