import { Box, Typography } from '@mui/material';

interface DetailFieldProps {
  label: string;
  value: string;
}

export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', flexShrink: 0, mr: 2 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}
