import { useState } from 'react';

import { Box, Button, Container, TextField, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

export function CTASection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [email, setEmail] = useState('');

  return (
    <Box
      sx={{
        py: 12,
        background: isDark
          ? 'linear-gradient(135deg, #1e3a5f 0%, #1a1a2e 50%, #16213e 100%)'
          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
        color: '#ffffff',
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            mb: 2,
            fontSize: { xs: '1.75rem', md: '2.25rem' },
          }}
        >
          Ready to make your data work for you?
        </Typography>
        <Typography sx={{ mb: 4, opacity: 0.9, fontSize: '1.1rem' }}>
          Start searching your documents in minutes, not weeks.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, maxWidth: 440, mx: 'auto', mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.15)',
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.6)' },
            }}
          />
          <Link to="/auth/register" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#fff',
                color: '#1d4ed8',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                px: 3,
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}
            >
              Get Started
            </Button>
          </Link>
        </Box>

        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          No credit card required. Free tier available.
        </Typography>
      </Container>
    </Box>
  );
}
