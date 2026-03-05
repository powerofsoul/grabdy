import type { RenewalType } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

import { FONT_MONO } from '@/theme';

interface RenewalCount {
  type: RenewalType;
  label: string;
  count: number;
}

interface RenewalBreakdownProps {
  breakdown: RenewalCount[];
}

const BAR_OPACITIES = [0.85, 0.5, 0.2] as const;

export function RenewalBreakdown({ breakdown }: RenewalBreakdownProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  if (breakdown.length === 0) return null;

  const total = breakdown.reduce((sum, b) => sum + b.count, 0);

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 2,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'block',
        }}
      >
        Renewal exposure
      </Typography>

      {/* Stacked bar */}
      <Box sx={{ display: 'flex', height: 6, mb: 2, overflow: 'hidden' }}>
        {breakdown.map((entry, i) => {
          const pct = total > 0 ? (entry.count / total) * 100 : 0;
          return (
            <Box
              key={entry.type}
              sx={{
                width: `${pct}%`,
                bgcolor:
                  entry.type === 'auto'
                    ? theme.palette.error.main
                    : alpha(ct, BAR_OPACITIES[i % BAR_OPACITIES.length]),
                transition: 'width 0.6s ease',
              }}
            />
          );
        })}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {breakdown.map((entry, i) => (
          <Link
            key={entry.type}
            to="/dashboard/contracts"
            search={{ renewalType: entry.type }}
            style={{ textDecoration: 'none' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 0.5,
                mx: -0.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                  bgcolor:
                    entry.type === 'auto'
                      ? theme.palette.error.main
                      : alpha(ct, BAR_OPACITIES[i % BAR_OPACITIES.length]),
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
                {entry.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontFamily: FONT_MONO, color: 'text.primary', flexShrink: 0 }}
              >
                {entry.count}
              </Typography>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  );
}
