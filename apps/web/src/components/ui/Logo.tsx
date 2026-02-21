import { Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ size = 'md' }: LogoProps) {
  const fontSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
      <Typography
        sx={{
          fontSize,
          fontWeight: 700,
          color: 'text.primary',
          letterSpacing: '-0.03em',
        }}
      >
        grabdy
      </Typography>
    </Link>
  );
}
