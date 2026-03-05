import { alpha, Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

interface ExpiredBadgeProps {
  expiredCount: number;
}

export function ExpiredBadge({ expiredCount }: ExpiredBadgeProps) {
  const theme = useTheme();

  if (expiredCount <= 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mt: 2,
        px: 2,
        py: 1,
        bgcolor: alpha(theme.palette.text.secondary, 0.04),
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
        {expiredCount} {expiredCount === 1 ? 'contract has' : 'contracts have'} expired
      </Typography>
      <Link
        to="/dashboard/contracts"
        search={{ status: 'past' }}
        style={{ textDecoration: 'none' }}
      >
        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500 }}>
          View
        </Typography>
      </Link>
    </Box>
  );
}
