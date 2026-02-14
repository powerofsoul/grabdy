import { useCallback } from 'react';

import { dbIdSchema } from '@grabdy/common';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import { FileTextIcon } from '@phosphor-icons/react';

import { DocumentPreviewDrawer } from '../../chat/DocumentPreviewDrawer';

import { useDrawer } from '@/context/DrawerContext';

interface SourceLinkComponentProps {
  data: {
    sources: Array<{
      name: string;
      score?: number;
      chunkId?: string;
      dataSourceId?: string;
      collectionId?: string;
    }>;
  };
}

export function SourceLinkComponent({ data }: SourceLinkComponentProps) {
  const theme = useTheme();
  const { pushDrawer } = useDrawer();

  const handleClick = useCallback(
    (source: SourceLinkComponentProps['data']['sources'][number]) => {
      if (!source.dataSourceId) return;
      const parsed = dbIdSchema('DataSource').safeParse(source.dataSourceId);
      if (!parsed.success) return;
      pushDrawer(
        (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} />,
        { title: source.name, mode: 'dialog', maxWidth: 'lg' },
      );
    },
    [pushDrawer],
  );

  return (
    <Box
      sx={{
        px: 1.5,
        pb: 1,
        pt: 0.75,
        mt: 0.5,
        borderTop: '1px solid',
        borderColor: alpha(theme.palette.text.primary, 0.06),
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        alignItems: 'center',
      }}
    >
      {data.sources.map((source, i) => {
        const clickable = Boolean(source.dataSourceId);
        return (
          <Box
            key={i}
            onClick={clickable ? () => handleClick(source) : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.text.primary, 0.04),
              cursor: clickable ? 'pointer' : 'default',
              transition: 'background-color 120ms ease',
              '&:hover': clickable
                ? {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    '& .source-name': { color: theme.palette.primary.main },
                  }
                : { bgcolor: alpha(theme.palette.text.primary, 0.08) },
            }}
          >
            <FileTextIcon size={10} weight="light" color={alpha(theme.palette.text.primary, 0.35)} style={{ flexShrink: 0 }} />
            <Typography
              className="source-name"
              sx={{
                fontSize: 10,
                color: alpha(theme.palette.text.primary, 0.55),
                lineHeight: 1.2,
                fontWeight: 500,
                transition: 'color 120ms ease',
              }}
              noWrap
            >
              {source.name}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
