import { Box, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

function LogoIcon({ size }: { size: number }) {
  const theme = useTheme();
  const p = theme.palette.primary.main;

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Bold G — arc (C-shape opening right) */}
      <path
        d="M25 11 A10 10 0 1 0 25 21"
        stroke={p}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* G crossbar */}
      <path
        d="M25 16 H17"
        stroke={p}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ size = 'md' }: LogoProps) {
  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 32 : 26;
  const fontSize = size === 'sm' ? '1rem' : size === 'lg' ? '1.5rem' : '1.25rem';

  return (
    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <LogoIcon size={iconSize} />
        <Typography
          sx={{
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'text.primary',
          }}
        >
          grabdy
          <Box component="span" sx={{ color: 'primary.main' }}>.</Box>
        </Typography>
      </Box>
    </Link>
  );
}
