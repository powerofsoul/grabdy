import { alpha, Box, Typography } from '@mui/material';

import { FileIcon } from './FileIcon';
import { formatLocation } from './helpers';
import type { SourceItemProps } from './types';

export function SourceItem({ source, onOpen, compact }: SourceItemProps) {
  const location = formatLocation(source);
  const label = compact && location ? location.trim() : `${source.dataSourceName}${location}`;

  return (
    <Box
      onClick={() => onOpen(source)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
        cursor: 'pointer',
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
      }}
    >
      <FileIcon name={source.dataSourceName} size={11} />
      <Typography
        noWrap
        sx={{
          fontSize: '0.65rem',
          color: 'text.secondary',
          lineHeight: 1.2,
          maxWidth: 200,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
