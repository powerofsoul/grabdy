import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CaretRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

export function SectionHeader({
  label,
  to,
  action,
}: {
  label: string;
  to?: string;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  const content = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        ...(to && {
          cursor: 'pointer',
          '&:hover .section-label': { color: alpha(ct, 0.5) },
        }),
      }}
    >
      <Typography
        variant="overline"
        className="section-label"
        sx={{
          color: alpha(ct, 0.25),
          transition: 'color 120ms ease',
        }}
      >
        {label}
      </Typography>
      {to && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: alpha(ct, 0.2),
          }}
        >
          <CaretRightIcon size={10} weight="light" color="currentColor" />
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: '20px', mb: 0.5 }}>
      {to ? (
        <Link to={to} style={{ textDecoration: 'none' }}>
          {content}
        </Link>
      ) : (
        content
      )}
      {action && <Box sx={{ ml: 'auto' }}>{action}</Box>}
    </Box>
  );
}
