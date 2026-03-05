import type { ReactNode } from 'react';

import { alpha, Box, Tooltip } from '@mui/material';
import { Link, useLocation } from '@tanstack/react-router';

export function StripIcon({
  to,
  label,
  icon,
  exact,
  activePrefix,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  activePrefix?: string;
}) {
  const location = useLocation();
  const matchPath = activePrefix ?? to;
  const isActive = exact
    ? location.pathname === matchPath
    : location.pathname.startsWith(matchPath);

  return (
    <Tooltip title={label} placement="right">
      <Link to={to} style={{ textDecoration: 'none' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            cursor: 'pointer',
            color: isActive ? 'text.primary' : (t) => alpha(t.palette.text.primary, 0.4),
            borderLeft: '2px solid',
            borderLeftColor: isActive ? 'text.primary' : 'transparent',
            bgcolor: 'transparent',
            transition: 'all 120ms ease',
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
              color: 'text.primary',
            },
          }}
        >
          {icon}
        </Box>
      </Link>
    </Tooltip>
  );
}
