import type { SxProps, Theme } from '@mui/material';

import { FONT_MONO } from '@/theme';

/**
 * Markdown styling for documentation pages.
 * Dark code blocks with GitHub-style syntax highlighting.
 */
export const docPageMarkdownStyles: SxProps<Theme> = {
  '& h1': { fontSize: '1.25rem', fontWeight: 600, mt: 0, mb: 1.5, color: 'text.primary', lineHeight: 1.3 },
  '& h2': { fontSize: '1.1rem', fontWeight: 600, mt: 2.5, mb: 1, color: 'text.primary', lineHeight: 1.3 },
  '& h3': { fontSize: '0.95rem', fontWeight: 600, mt: 2, mb: 0.75, color: 'text.primary', lineHeight: 1.3 },
  '& h4': { fontSize: '0.9rem', fontWeight: 600, mt: 1.5, mb: 0.5, color: 'text.primary', lineHeight: 1.3 },
  '& p': { fontSize: '0.85rem', mb: 1, color: 'text.secondary', lineHeight: 1.7, m: 0 },
  '& p + p': { mt: 1 },
  '& ul, & ol': { pl: 2.5, my: 1, m: 0 },
  '& li': { fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.7 },
  '& li + li': { mt: 0.25 },
  '& a': { color: 'primary.main', textDecoration: 'none' },
  '& a:hover': { textDecoration: 'underline' },
  '& blockquote': {
    borderLeft: '3px solid',
    borderColor: 'divider',
    pl: 2,
    ml: 0,
    my: 1,
    color: 'text.secondary',
  },
  '& hr': { my: 1.5, border: 'none', borderTop: '1px solid', borderColor: 'divider' },
  // Tables
  '& table': { borderCollapse: 'collapse', my: 1.5, width: '100%', fontSize: '0.82rem' },
  '& th, & td': {
    border: '1px solid',
    borderColor: 'divider',
    px: 1.5,
    py: 0.75,
    textAlign: 'left',
  },
  '& th': { fontWeight: 600, bgcolor: 'action.hover' },
  // Inline code
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
  // Code blocks
  '& pre': {
    bgcolor: 'grey.900',
    color: 'grey.100',
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
  // Syntax highlighting (theme-aware tokens)
  '& .hljs-comment, & .hljs-quote': { color: 'grey.500' },
  '& .hljs-keyword, & .hljs-selector-tag': { color: 'error.light' },
  '& .hljs-string, & .hljs-attr': { color: 'info.light' },
  '& .hljs-number, & .hljs-literal': { color: 'info.main' },
  '& .hljs-variable, & .hljs-template-variable': { color: 'warning.light' },
  '& .hljs-type, & .hljs-built_in': { color: 'success.light' },
  '& .hljs-title, & .hljs-function': { color: 'secondary.light' },
  '& .hljs-symbol, & .hljs-bullet': { color: 'warning.main' },
  '& .hljs-section': { color: 'info.main', fontWeight: 700 },
  // Details/summary (source references)
  '& details': {
    my: 1,
    p: 1,
    bgcolor: 'action.hover',
    borderRadius: 1,
    fontSize: '0.82rem',
  },
  '& details summary': {
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.8rem',
    color: 'text.secondary',
    userSelect: 'none',
  },
  '& details[open] summary': {
    mb: 0.5,
  },
  '& details ul': {
    m: 0,
    mt: 0.5,
    pl: 2,
  },
  '& details li': {
    fontSize: '0.78rem',
    color: 'text.secondary',
  },
};
