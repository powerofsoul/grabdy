import { alpha, Box, Typography, useTheme } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';

import { formatCompactCurrency } from '../helpers';

import { FONT_MONO } from '@/theme';

interface CounterpartyRow {
  name: string;
  count: number;
  payable: number;
  receivable: number;
}

interface CounterpartyConcentrationProps {
  counterparties: CounterpartyRow[];
}

export function CounterpartyConcentration({ counterparties }: CounterpartyConcentrationProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const ct = theme.palette.text.primary;

  if (counterparties.length === 0) return null;

  const maxValue = Math.max(...counterparties.map((c) => c.payable + c.receivable));

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
        Top counterparties
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {counterparties.map((cp) => {
          const totalValue = cp.payable + cp.receivable;
          const barPct = maxValue > 0 ? (totalValue / maxValue) * 100 : 0;

          return (
            <Box
              key={cp.name}
              onClick={() =>
                navigate({ to: '/dashboard/contracts', search: { counterparty: cp.name } })
              }
              sx={{ cursor: 'pointer', '&:hover': { '& .bar': { opacity: 0.9 } } }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }} noWrap>
                  {cp.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {cp.count} {cp.count === 1 ? 'contract' : 'contracts'}
                  </Typography>
                  {totalValue > 0 && (
                    <Typography
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: '0.78rem',
                        color: 'text.secondary',
                      }}
                    >
                      {formatCompactCurrency(totalValue)}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box
                sx={{
                  height: 4,
                  bgcolor: alpha(ct, 0.06),
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box
                  className="bar"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${barPct}%`,
                    bgcolor: alpha(ct, 0.35),
                    transition: 'width 0.6s ease, opacity 0.12s ease',
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
