import { alpha, Box, Typography, useTheme } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';

export function NavItem({
  to,
  label,
  exact,
  icon,
  trailing,
  activePrefix,
  indent,
}: {
  to: string;
  label: string;
  exact?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  activePrefix?: string;
  indent?: boolean;
}) {
  const location = useLocation();
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const matchPath = activePrefix ?? to;
  const isActive = exact
    ? location.pathname === matchPath
    : location.pathname.startsWith(matchPath);

  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 34,
          pl: indent ? 4.5 : 2,
          pr: 2,
          mx: '8px',

          cursor: 'pointer',
          borderRadius: 1,
          bgcolor: isActive ? alpha(ct, 0.06) : 'transparent',
          transition: 'color 120ms ease, background-color 120ms ease',
          '&:hover': {
            bgcolor: alpha(ct, isActive ? 0.08 : 0.03),
            borderRadius: 1,
          },
        }}
      >
        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: isActive ? 'text.primary' : 'text.secondary',
            }}
          >
            {icon}
          </Box>
        )}
        <Typography
          noWrap
          sx={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'text.primary' : 'text.secondary',
            lineHeight: 1.4,
          }}
        >
          {label}
        </Typography>
        {trailing}
      </Box>
    </Link>
  );
}
