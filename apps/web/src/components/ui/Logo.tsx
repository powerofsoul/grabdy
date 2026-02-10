import { Box, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import { Zap } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
  const fontSize = size === 'sm' ? '1rem' : size === 'lg' ? '1.5rem' : '1.25rem';

  return (
    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Zap size={iconSize} fill="currentColor" color="currentColor" />
        <Typography
          sx={{
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'text.primary',
          }}
        >
          fastdex
        </Typography>
      </Box>
    </Link>
  );
}
