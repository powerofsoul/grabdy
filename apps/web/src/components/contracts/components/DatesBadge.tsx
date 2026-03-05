import { alpha, Box, Typography, useTheme } from '@mui/material';

interface DatesBadgeProps {
  daysLeft: number | null;
}

export function DatesBadge({ daysLeft }: DatesBadgeProps) {
  const theme = useTheme();

  if (daysLeft === null) return null;

  const color =
    daysLeft <= 30
      ? theme.palette.error.main
      : daysLeft <= 60
        ? theme.palette.warning.main
        : daysLeft <= 90
          ? theme.palette.success.main
          : theme.palette.text.secondary;

  const label =
    daysLeft < 0
      ? `Expired ${Math.abs(daysLeft)}d ago`
      : daysLeft === 0
        ? 'Expires today'
        : `${daysLeft}d remaining`;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        px: 1.5,
        py: 0.5,
        bgcolor: alpha(color, 0.1),
        border: '1px solid',
        borderColor: alpha(color, 0.25),
      }}
    >
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}</Typography>
    </Box>
  );
}
