import { alpha, Box, Typography, useTheme } from '@mui/material';
import { WarningCircleIcon } from '@phosphor-icons/react';

const DEVIATIONS = [
  {
    clause: 'Liability cap',
    standard: '12 months of fees',
    incoming: '6 months of fees',
    severity: 'high',
  },
  {
    clause: 'Arbitration',
    standard: 'Not present',
    incoming: 'Binding arbitration, Section 11',
    severity: 'high',
  },
  {
    clause: 'Data residency',
    standard: 'US-only',
    incoming: 'US-only',
    severity: 'none',
  },
  {
    clause: 'Termination notice',
    standard: '90 days',
    incoming: '60 days',
    severity: 'medium',
  },
] as const;

type Severity = 'high' | 'medium' | 'none';

function SeverityBadge({ severity }: { severity: Severity }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  if (severity === 'none') {
    return (
      <Typography
        sx={{
          fontSize: '0.62rem',
          fontWeight: 600,
          color: 'success.main',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Match
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        px: 0.75,
        py: 0.125,
        borderRadius: 0.75,
        bgcolor: severity === 'high' ? alpha(theme.palette.error.main, 0.1) : alpha(ct, 0.06),
      }}
    >
      {severity === 'high' && (
        <WarningCircleIcon size={10} weight="fill" color={theme.palette.error.main} />
      )}
      <Typography
        sx={{
          fontSize: '0.6rem',
          fontWeight: 600,
          color: severity === 'high' ? 'error.main' : 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {severity === 'high' ? 'Deviation' : 'Changed'}
      </Typography>
    </Box>
  );
}

export function DeviationPanel() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ maxWidth: 520 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.08),
          bgcolor: alpha(ct, 0.02),
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          border: '1px solid',
        }}
      >
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary' }}>
          Deviation report
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.65rem', color: 'error.main', fontWeight: 600 }}>
            2 deviations
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            1 changed, 1 match
          </Typography>
        </Box>
      </Box>

      {/* Table header */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.5fr 1.5fr 80px',
          px: 2,
          py: 0.75,
          borderLeft: '1px solid',
          borderRight: '1px solid',
          borderColor: alpha(ct, 0.08),
          bgcolor: alpha(ct, 0.015),
        }}
      >
        {['Clause', 'Your standard', 'Incoming terms', 'Status'].map((h) => (
          <Typography
            key={h}
            sx={{
              fontSize: '0.62rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.disabled',
            }}
          >
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      {DEVIATIONS.map((d, i) => (
        <Box
          key={d.clause}
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1.5fr 1.5fr 80px',
            px: 2,
            py: 1,
            alignItems: 'center',
            borderLeft: '1px solid',
            borderRight: '1px solid',
            borderBottom: '1px solid',
            borderColor: alpha(ct, 0.08),
            ...(d.severity === 'high' && {
              bgcolor: alpha(theme.palette.error.main, 0.03),
            }),
            ...(i === DEVIATIONS.length - 1 && {
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
            }),
          }}
        >
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            {d.clause}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.secondary',
            }}
          >
            {d.standard}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: d.severity === 'none' ? 'text.secondary' : 'text.primary',
              fontWeight: d.severity === 'high' ? 600 : 400,
            }}
          >
            {d.incoming}
          </Typography>
          <SeverityBadge severity={d.severity} />
        </Box>
      ))}
    </Box>
  );
}
