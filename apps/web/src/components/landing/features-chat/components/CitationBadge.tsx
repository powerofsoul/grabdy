import { useCallback, useState } from 'react';

import { alpha, Box, Popover, Typography } from '@mui/material';
import { ArrowSquareOutIcon, FileTextIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

import type { MockSource } from '../types';

export function CitationBadge({ refNumber, source }: { refNumber: number; source: MockSource }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  return (
    <>
      <Box
        component="span"
        onClick={handleClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          px: 0.75,
          py: '3px',
          mx: '3px',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
          cursor: 'pointer',
          verticalAlign: 'baseline',
          lineHeight: 1,
          transition: 'all 120ms ease',
          '&:hover': {
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
          },
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          <FileTextIcon size={14} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'text.secondary',
            lineHeight: 1,
          }}
        >
          {refNumber}
        </Box>
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 340,
              p: 0,
              overflow: 'hidden',
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <FileTextIcon size={14} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />
          <Typography
            noWrap
            sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'text.primary',
              flex: 1,
              minWidth: 0,
            }}
          >
            {source.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: 'text.disabled',
              flexShrink: 0,
            }}
          >
            {source.location}
          </Typography>
        </Box>

        {/* Content excerpt */}
        <Box sx={{ px: 1.5, py: 1.25 }}>
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.secondary',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {source.excerpt}
          </Typography>
        </Box>

        {/* Footer */}
        <Box
          component={Link}
          to="/auth/signup"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.75,
            cursor: 'pointer',
            borderTop: '1px solid',
            borderColor: 'divider',
            textDecoration: 'none',
            '&:hover': {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            },
          }}
        >
          <ArrowSquareOutIcon size={11} weight="light" />
          <Typography
            sx={{
              fontSize: '0.65rem',
              color: 'primary.main',
              fontWeight: 500,
            }}
          >
            Sign up to try it yourself
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
