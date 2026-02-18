import { Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const fontSize = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;

  return (
    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Typography variant="h5" sx={{ fontSize, color: 'text.primary' }}>
        grabdy.
      </Typography>
    </Link>
  );
}
