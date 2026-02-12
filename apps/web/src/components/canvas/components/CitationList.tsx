import { alpha, Box, Typography, useTheme } from '@mui/material';
import { ExternalLink, FileText } from 'lucide-react';

import type { Citation } from '@grabdy/contracts';

interface CitationListProps {
  citations: Citation[];
}

export function CitationList({ citations }: CitationListProps) {
  const theme = useTheme();

  if (citations.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        pt: 0.75,
        mt: 0.75,
        borderTop: '1px solid',
        borderColor: alpha(theme.palette.text.primary, 0.06),
      }}
    >
      {citations.map((citation, i) => {
        const isClickable = Boolean(citation.url);
        return (
          <Box
            key={i}
            component={isClickable ? 'a' : 'span'}
            {...(isClickable ? { href: citation.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              color: 'primary.main',
              fontSize: 10,
              fontWeight: 500,
              textDecoration: 'none',
              cursor: isClickable ? 'pointer' : 'default',
              transition: 'background-color 120ms ease',
              '&:hover': isClickable
                ? { bgcolor: alpha(theme.palette.primary.main, 0.12) }
                : {},
            }}
          >
            {isClickable ? <ExternalLink size={9} /> : <FileText size={9} />}
            <Typography component="span" sx={{ fontSize: 10, fontWeight: 500, color: 'inherit' }}>
              {citation.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
