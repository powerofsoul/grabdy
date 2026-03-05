import type { Contract } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';

import { formatCompactCurrency, formatDaysLeft } from '../helpers';

import { FONT_MONO } from '@/theme';

type DeadlineRow = Contract & { daysLeft: number | null };

interface HighValueExpiringProps {
  contracts: DeadlineRow[];
}

export function HighValueExpiring({ contracts }: HighValueExpiringProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  if (contracts.length === 0) return null;

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
        Highest value at risk
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {contracts.map((c, index) => {
          const color =
            c.daysLeft !== null && c.daysLeft <= 30
              ? theme.palette.error.main
              : c.daysLeft !== null && c.daysLeft <= 60
                ? theme.palette.warning.main
                : theme.palette.text.secondary;

          return (
            <Box
              key={c.id}
              onClick={() =>
                navigate({ to: '/dashboard/contracts/$contractId', params: { contractId: c.id } })
              }
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                ...(index < contracts.length - 1 && {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }),
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {c.title}
                </Typography>
                {c.counterparty && (
                  <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                    {c.counterparty}
                  </Typography>
                )}
              </Box>

              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  color: 'text.primary',
                  flexShrink: 0,
                }}
              >
                {formatCompactCurrency(c.totalValue ?? 0)}
              </Typography>

              {c.daysLeft !== null && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    px: 1,
                    py: 0.25,
                    bgcolor: alpha(color, 0.1),
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color }}>
                    {formatDaysLeft(c.daysLeft)}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
