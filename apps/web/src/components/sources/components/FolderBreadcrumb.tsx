import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CaretRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

import { useBreadcrumb } from '../hooks/useCollections';

export function FolderBreadcrumb({ collectionId }: { collectionId: string }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const crumbs = useBreadcrumb(collectionId);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Link to="/dashboard/sources" style={{ textDecoration: 'none' }}>
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          Files
        </Typography>
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Box key={crumb.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CaretRightIcon size={10} weight="bold" color={alpha(ct, 0.3)} />
            {isLast ? (
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                {crumb.name}
              </Typography>
            ) : (
              <Link
                to="/dashboard/sources/$collectionId"
                params={{ collectionId: crumb.id }}
                style={{ textDecoration: 'none' }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    color: 'text.secondary',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  {crumb.name}
                </Typography>
              </Link>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
