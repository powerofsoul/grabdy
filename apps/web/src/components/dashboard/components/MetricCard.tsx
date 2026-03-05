import { alpha, Box, Skeleton, Typography, useTheme } from '@mui/material';

import { useCountUp } from '../hooks/useCountUp';

import { FONT_MONO } from '@/theme';

interface MetricCardProps {
  value: number;
  label: string;
  isLoading: boolean;
  format?: (n: number) => string;
}

export function MetricCard({ value, label, isLoading, format }: MetricCardProps) {
  const displayValue = useCountUp(value);
  const theme = useTheme();

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderTop: '2px solid',
        borderTopColor: alpha(theme.palette.text.primary, 0.08),
        p: { xs: 1.5, sm: 2.5 },
      }}
    >
      {isLoading ? (
        <Skeleton variant="text" width={48} sx={{ fontSize: '2rem', lineHeight: 1 }} />
      ) : (
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: { xs: '1.25rem', sm: '2rem' },
            fontWeight: 400,
            lineHeight: 1,
            color: 'text.primary',
          }}
        >
          {format ? format(displayValue) : displayValue}
        </Typography>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
        {label}
      </Typography>
    </Box>
  );
}
