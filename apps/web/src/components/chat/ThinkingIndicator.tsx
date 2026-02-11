import { alpha, Box, Typography, useTheme } from '@mui/material';
import { Brain } from 'lucide-react';

export function ThinkingIndicator() {
  const theme = useTheme();
  const primary = theme.palette.primary.main;

  return (
    <Box sx={{ maxWidth: '90%' }}>
      {/* Brain pill */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: alpha(primary, 0.08),
          border: '1px solid',
          borderColor: alpha(primary, 0.15),
        }}
      >
        <Brain size={12} color={primary} />
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: primary,
          }}
        >
          Thinking
        </Typography>
        {/* Animated dots */}
        <Box sx={{ display: 'flex', gap: '3px', ml: 0.25 }}>
          {[0, 1, 2].map((d) => (
            <Box
              key={d}
              sx={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                bgcolor: primary,
                animation: `dotPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
