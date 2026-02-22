import { alpha, Box, Typography } from '@mui/material';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';

import { FileIcon } from './FileIcon';
import { formatLocation, isExternalSource, isIntegrationProvider } from './helpers';
import type { SourceItemProps } from './types';

import { ProviderIcon } from '@/components/integrations/ProviderIcon';

export function SourceItem({ source, onOpen }: SourceItemProps) {
  const isExternal = isExternalSource(source.type);
  const hasUrl = Boolean(source.sourceUrl);
  const isCodeRepo = source.type === 'CODE_REPO';
  const clickable = hasUrl || isCodeRepo || !isExternal;

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
      {source.type === 'CODE_REPO' ? (
        <ProviderIcon provider="GITHUB" size={11} />
      ) : isIntegrationProvider(source.type) ? (
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
        {source.type === 'CODE_REPO' && source.docPageTitle
          ? source.docPageTitle
          : `${source.dataSourceName}${formatLocation(source)}`}
      </Typography>
      {(hasUrl || (isCodeRepo && source.filePath)) && (
        <ArrowSquareOutIcon size={9} weight="light" style={{ flexShrink: 0, opacity: 0.4 }} />
      )}
    </Box>
  );
}
