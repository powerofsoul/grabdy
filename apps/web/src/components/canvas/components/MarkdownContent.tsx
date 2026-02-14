import ReactMarkdown from 'react-markdown';

import { alpha, Box, useTheme } from '@mui/material';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function MarkdownContent({ content, fontSize = 13, color, align }: MarkdownContentProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        fontSize,
        lineHeight: 1.6,
        color: color ?? 'text.primary',
        textAlign: align ?? 'left',
        '& p': { m: 0, mb: 1 },
        '& p:last-child': { mb: 0 },
        '& h1': { fontSize: '1.4em', fontWeight: 700, mt: 0, mb: 0.5 },
        '& h2': { fontSize: '1.2em', fontWeight: 600, mt: 0, mb: 0.5 },
        '& h3': { fontSize: '1.05em', fontWeight: 600, mt: 0, mb: 0.5 },
        '& ul, & ol': { m: 0, pl: 2.5 },
        '& blockquote': {
          m: 0,
          pl: 1.5,
          borderLeft: '3px solid',
          borderColor: alpha(theme.palette.text.primary, 0.15),
          color: 'text.secondary',
        },
        '& code': {
          fontSize: '0.9em',
          bgcolor: alpha(theme.palette.text.primary, 0.06),
          px: 0.5,
          py: 0.1,
          borderRadius: 0.5,
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid',
          borderColor: alpha(theme.palette.text.primary, 0.1),
          my: 1,
        },
        '& a': { color: 'primary.main', textDecoration: 'underline' },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}
