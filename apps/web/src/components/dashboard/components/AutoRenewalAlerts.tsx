import type { Contract } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';

import {
  computeNoticeDaysLeft,
  formatCompactCurrency,
  formatDate,
  formatDaysLeft,
  getNoticeBadgeColor,
} from '../helpers';

type DeadlineRow = Contract & { daysLeft: number | null };

interface AutoRenewalAlertsProps {
  deadlines: DeadlineRow[];
}

export function AutoRenewalAlerts({ deadlines }: AutoRenewalAlertsProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const autoRenewals = deadlines
    .filter(
      (d) =>
        d.renewalType === 'auto' &&
        d.noticeByDate !== null &&
        computeNoticeDaysLeft(d.noticeByDate) >= -7 &&
        computeNoticeDaysLeft(d.noticeByDate) <= 90
    )
    .sort((a, b) => {
      if (a.noticeByDate === null || b.noticeByDate === null) return 0;
      return computeNoticeDaysLeft(a.noticeByDate) - computeNoticeDaysLeft(b.noticeByDate);
    })
    .slice(0, 5);

  if (autoRenewals.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 2,
          display: 'block',
        }}
      >
        Action required
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {autoRenewals.map((d) => {
          const noticeDays = d.noticeByDate !== null ? computeNoticeDaysLeft(d.noticeByDate) : null;
          const color =
            noticeDays !== null
              ? getNoticeBadgeColor(noticeDays, theme.palette)
              : theme.palette.text.secondary;
          const isUrgent = noticeDays !== null && noticeDays <= 14;

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
                borderLeft: isUrgent
                  ? `3px solid ${theme.palette.error.main}`
                  : '3px solid transparent',
                bgcolor: isUrgent ? alpha(theme.palette.error.main, 0.04) : 'transparent',
                '&:hover': {
                  bgcolor: isUrgent ? alpha(theme.palette.error.main, 0.08) : 'action.hover',
                },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {d.counterparty ? `${d.counterparty} · ` : ''}
                  {d.title}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                  Auto-renews if no notice by{' '}
                  {d.noticeByDate !== null ? formatDate(d.noticeByDate) : '-'}
                  {d.renewalTermMonths !== null && d.renewalTermMonths !== undefined
                    ? `, renews for ${d.renewalTermMonths} months`
                    : ''}
                </Typography>
              </Box>

              {(d.payableValue != null || d.receivableValue != null) && (
                <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  {formatCompactCurrency((d.payableValue ?? 0) + (d.receivableValue ?? 0))}
                </Typography>
              )}

              {noticeDays !== null && (
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
                    {formatDaysLeft(noticeDays)}
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
