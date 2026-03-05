import type { Contract } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link, useNavigate } from '@tanstack/react-router';

import { formatDate, formatDaysLeft, getDaysLeftColor } from '../helpers';

type DeadlineRow = Contract & { daysLeft: number | null };

interface UrgentAlertsProps {
  deadlines: DeadlineRow[];
}

export function UrgentAlerts({ deadlines }: UrgentAlertsProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  if (deadlines.length === 0) return null;

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
        Upcoming deadlines
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {deadlines.map((d, index) => {
          const color =
            d.daysLeft !== null
              ? getDaysLeftColor(d.daysLeft, theme.palette)
              : theme.palette.text.secondary;

          return (
            <Box
              key={d.id}
              onClick={() =>
                navigate({ to: '/dashboard/contracts/$contractId', params: { contractId: d.id } })
              }
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: { xs: 0.5, sm: 2 },
                px: { xs: 1, sm: 2 },
                py: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                ...(index < deadlines.length - 1 && {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }),
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {d.title}
                </Typography>
                {d.counterparty && (
                  <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                    {d.counterparty}
                  </Typography>
                )}
              </Box>

              <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                {formatDate(d.expirationDate)}
              </Typography>

              {d.daysLeft !== null && (
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
                    {formatDaysLeft(d.daysLeft)}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ mt: 2, px: 2 }}>
        <Link to="/dashboard/contracts" style={{ textDecoration: 'none' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500 }}>
              View all contracts
            </Typography>
            <ArrowRightIcon size={14} weight="bold" color={theme.palette.primary.main} />
          </Box>
        </Link>
      </Box>
    </Box>
  );
}
