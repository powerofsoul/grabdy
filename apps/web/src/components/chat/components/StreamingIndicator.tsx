import { Box, Typography } from '@mui/material';

export function StreamingIndicator() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 2, py: 1 }}>
      <Box sx={{ display: 'flex', gap: '3px' }}>
        {[0, 1, 2].map((d) => (
          <Box
            key={d}
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              animation: `dotPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
            }}
          />
        ))}
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontStyle: 'italic' }}>
        Thinking...
      </Typography>
    </Box>
  );
}
