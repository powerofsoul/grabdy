import { alpha, Box, Typography, useTheme } from '@mui/material';
import { ExternalLink, FileText } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

interface SourceLinkComponentProps {
  data: {
    sources: Array<{
      name: string;
      score?: number;
      chunkId?: string;
      dataSourceId?: string;
    }>;
  };
}

export function SourceLinkComponent({ data }: SourceLinkComponentProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleClick = (source: SourceLinkComponentProps['data']['sources'][number]) => {
    if (source.dataSourceId) {
      navigate({ to: '/dashboard/sources' });
    }
  };

  return (
    <Box
      sx={{
        pt: 1,
        mt: 0.5,
        borderTop: '1px solid',
        borderColor: alpha(theme.palette.text.primary, 0.06),
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.25,
        alignItems: 'center',
      }}
    >
      {data.sources.map((source, i) => {
        const clickable = !!source.dataSourceId;
        return (
          <Box
            key={i}
            onClick={clickable ? () => handleClick(source) : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: clickable ? 'pointer' : 'default',
              borderRadius: 0.5,
              px: 0.5,
              mx: -0.5,
              py: 0.25,
              transition: 'background-color 120ms ease',
              '&:hover': clickable
                ? {
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    '& .source-name': { color: theme.palette.primary.main },
                    '& .source-link-icon': { opacity: 1 },
                  }
                : {},
            }}
          >
            <FileText size={12} color={alpha(theme.palette.text.primary, 0.3)} style={{ flexShrink: 0 }} />
            <Typography
              className="source-name"
              sx={{
                fontSize: 11,
                color: alpha(theme.palette.text.primary, 0.5),
                lineHeight: 1,
                transition: 'color 120ms ease',
              }}
              noWrap
            >
              {source.name}
            </Typography>
            {source.score !== undefined && (
              <Typography sx={{ fontSize: 10, color: alpha(theme.palette.text.primary, 0.3) }}>
                {Math.round(source.score * 100)}%
              </Typography>
            )}
            {clickable && (
              <ExternalLink
                className="source-link-icon"
                size={9}
                color={theme.palette.primary.main}
                style={{ flexShrink: 0, opacity: 0, transition: 'opacity 120ms ease' }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
