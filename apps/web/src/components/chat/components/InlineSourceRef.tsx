import { useCallback, useState } from 'react';

import type { ChatSource } from '@grabdy/contracts';
import { alpha, Box, Popover, Typography } from '@mui/material';
import { ArrowSquareOutIcon, LockIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';

import { FileIcon } from './source-chips/FileIcon';
import { formatLocation } from './source-chips/helpers';
import { useOpenSource } from './source-chips/useOpenSource';

interface InlineSourceRefProps {
  refNumber: number;
  source: ChatSource | undefined;
  shareToken?: string;
}

export function InlineSourceRef({ refNumber, source, shareToken }: InlineSourceRefProps) {
  const openSource = useOpenSource();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!source) return;
      setAnchorEl(e.currentTarget);
    },
    [source]
  );

  const handleOpenSource = useCallback(() => {
    if (!source) return;
    setAnchorEl(null);
    openSource(source);
  }, [source, openSource]);

  const location = source ? formatLocation(source) : '';

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
          borderRadius: 1,
          bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
          cursor: source ? 'pointer' : 'default',
          verticalAlign: 'baseline',
          lineHeight: 1,
          transition: 'all 120ms ease',
          '&:hover': source
            ? {
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              }
            : {},
        }}
      >
        {source && (
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <FileIcon name={source.dataSourceName} size={14} />
          </Box>
        )}
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
      {source && (
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
                borderRadius: 2,
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
              borderBottom: source.content ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <FileIcon name={source.dataSourceName} size={14} />
            </Box>
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
              {source.dataSourceName}
            </Typography>
            {location && (
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.disabled',
                  flexShrink: 0,
                }}
              >
                {location.trim()}
              </Typography>
            )}
          </Box>

          {/* Content excerpt */}
          {source.content && (
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
                {source.content}
              </Typography>
            </Box>
          )}

          {/* Footer */}
          <Box
            component={shareToken ? Link : 'div'}
            {...(shareToken ? { to: '/auth/login' } : { onClick: handleOpenSource })}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.75,
              cursor: 'pointer',
              borderTop: '1px solid',
              borderColor: 'divider',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
              },
            }}
          >
            {shareToken ? (
              <>
                <LockIcon size={11} weight="light" />
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                    fontWeight: 500,
                  }}
                >
                  Sign in to view document
                </Typography>
              </>
            ) : (
              <>
                <ArrowSquareOutIcon size={11} weight="light" />
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    color: 'primary.main',
                    fontWeight: 500,
                  }}
                >
                  Open document
                </Typography>
              </>
            )}
          </Box>
        </Popover>
      )}
    </>
  );
}
