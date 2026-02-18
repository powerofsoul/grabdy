import type { SxProps, Theme } from '@mui/material';

import { FONT_MONO } from '@/theme';

/**
 * Markdown styling for assistant messages.
 * Dark code blocks with GitHub-style syntax highlighting.
 */
export const markdownStyles: SxProps<Theme> = {
  '& p': { m: 0, fontSize: '0.82rem', lineHeight: 1.6 },
  '& p + p': { mt: 1 },
  '& ul, & ol': { m: 0, pl: 2.5, my: 1 },
  '& li': { fontSize: '0.82rem' },
  '& li + li': { mt: 0.5 },
  '& h1, & h2, & h3, & h4': { mt: 1.5, mb: 0.75, lineHeight: 1.3 },
  '& h1': { fontSize: '1.1rem' },
  '& h2': { fontSize: '1rem' },
  '& h3': { fontSize: '0.95rem' },
  '& h4': { fontSize: '0.9rem' },
  '& blockquote': {
    m: 0,
    my: 1,
    pl: 2,
    borderLeft: '3px solid',
    borderColor: 'divider',
    color: 'text.secondary',
  },
  '& hr': { my: 1.5, border: 'none', borderTop: '1px solid', borderColor: 'divider' },
  '& table': { borderCollapse: 'collapse', my: 1, width: '100%', fontSize: '0.82rem' },
  '& th, & td': {
    border: '1px solid',
    borderColor: 'divider',
    px: 1.5,
    py: 0.75,
    textAlign: 'left',
  },
  '& th': { fontWeight: 600, bgcolor: 'action.hover' },
  '& :not(pre) > code, & pre': {
    fontFamily: FONT_MONO,
  },
  '& :not(pre) > code': {
    bgcolor: 'grey.100',
    px: 0.75,
    py: 0.25,
    borderRadius: 0.5,
    fontSize: '0.82rem',
  },
  '& pre': {
    bgcolor: '#1F2937',
    color: '#F9FAFB',
    p: 2,
    my: 1,
    borderRadius: 1.5,
    overflow: 'auto',
    fontSize: '0.82rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  '& pre code': {
    bgcolor: 'transparent',
    p: 0,
    color: 'inherit',
    fontSize: 'inherit',
    whiteSpace: 'pre-wrap',
  },
  // Syntax highlighting (GitHub dark theme)
  '& .hljs-comment, & .hljs-quote': { color: '#6a737d' },
  '& .hljs-keyword, & .hljs-selector-tag': { color: '#ff7b72' },
  '& .hljs-string, & .hljs-attr': { color: '#a5d6ff' },
  '& .hljs-number, & .hljs-literal': { color: '#79c0ff' },
  '& .hljs-variable, & .hljs-template-variable': { color: '#ffa657' },
  '& .hljs-type, & .hljs-built_in': { color: '#7ee787' },
  '& .hljs-title, & .hljs-function': { color: '#d2a8ff' },
  '& .hljs-symbol, & .hljs-bullet': { color: '#f2cc60' },
  '& .hljs-section': { color: '#79c0ff', fontWeight: 700 },
  // Links
  '& a': { color: 'primary.main', textDecoration: 'none' },
  '& a:hover': { textDecoration: 'underline' },
};
