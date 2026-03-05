import { alpha, Box, Typography, useTheme } from '@mui/material';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

interface AttentionBannerProps {
  urgentCount: number;
}

export function AttentionBanner({ urgentCount }: AttentionBannerProps) {
  const theme = useTheme();

  if (urgentCount <= 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: { xs: 1.5, sm: 2 },
        mb: 3,
        borderLeft: `3px solid ${theme.palette.error.main}`,
        bgcolor: alpha(theme.palette.error.main, 0.04),
      }}
    >
      <WarningCircleIcon size={18} weight="light" color={theme.palette.error.main} />
      <Typography variant="body2" sx={{ color: 'text.primary', flex: 1 }}>
        {urgentCount} {urgentCount === 1 ? 'contract needs' : 'contracts need'} attention within 30
        days
      </Typography>
      <Link to="/dashboard/contracts" style={{ textDecoration: 'none' }}>
        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500 }}>
          View
        </Typography>
      </Link>
    </Box>
  );
}
