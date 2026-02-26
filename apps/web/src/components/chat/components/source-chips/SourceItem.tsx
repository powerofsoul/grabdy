import { alpha, Box, Typography } from '@mui/material';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';

import { FileIcon } from './FileIcon';
import { formatLocation, isIntegrationProvider } from './helpers';
import type { SourceItemProps } from './types';

import { ProviderIcon } from '@/components/integrations/ProviderIcon';

export function SourceItem({ source, onOpen, compact }: SourceItemProps) {
  const isExternal = isIntegrationProvider(source.type);
  const hasUrl = Boolean(source.sourceUrl);
  const clickable = hasUrl || !isExternal;

  const location = formatLocation(source);
  const label = compact && location ? location.trim() : `${source.dataSourceName}${location}`;

  return (
    <Box
      onClick={clickable ? () => onOpen(source) : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background-color 120ms ease',
        '&:hover': clickable ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } : {},
      }}
    >
      {isIntegrationProvider(source.type) ? (
        <ProviderIcon provider={source.type} size={11} />
      ) : (
        <FileIcon name={source.dataSourceName} size={11} />
      )}
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
      {hasUrl && (
        <ArrowSquareOutIcon size={9} weight="light" style={{ flexShrink: 0, opacity: 0.4 }} />
      )}
    </Box>
  );
}
