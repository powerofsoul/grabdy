import { Box, Typography } from '@mui/material';

interface MetadataFieldProps {
  label: string;
  value: string | null | undefined;
  fallback?: string;
}

export function MetadataField({ label, value, fallback = 'Not specified' }: MetadataFieldProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', flexShrink: 0, mr: 2 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.875rem',
          color: value ? 'text.primary' : 'text.disabled',
          textAlign: 'right',
        }}
      >
        {value ?? fallback}
      </Typography>
    </Box>
  );
}
