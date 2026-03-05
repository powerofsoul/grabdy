import { Box, useTheme } from '@mui/material';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import { createFileRoute } from '@tanstack/react-router';

import '@scalar/api-reference-react/style.css';

export const Route = createFileRoute('/docs')({
  head: () => ({
    meta: [
      { title: 'API Documentation - Grabdy' },
      {
        name: 'description',
        content:
          'Explore the Grabdy REST API. Upload documents, search your knowledge base, and manage collections programmatically.',
      },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const darkModeState = isDark ? 'dark' : 'light';

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        '& .scalar-api-reference': {
          flex: 1,
          overflow: 'auto',

          '--scalar-font': '"Inter", "SF Pro", system-ui, sans-serif',
          '--scalar-font-code': '"Geist Mono", "JetBrains Mono", monospace',

          '--scalar-background-1': theme.palette.background.default,
          '--scalar-background-2': theme.palette.background.paper,
          '--scalar-background-3': isDark ? theme.palette.grey[800] : theme.palette.grey[100],
          '--scalar-sidebar-background-1': theme.palette.background.default,
          '--scalar-sidebar-color-1': theme.palette.text.primary,
          '--scalar-sidebar-color-2': theme.palette.text.secondary,
          '--scalar-sidebar-search-background': isDark
            ? theme.palette.grey[100]
            : theme.palette.grey[200],
          '--scalar-sidebar-search-border-color': theme.palette.divider,
          '--scalar-sidebar-search-color': theme.palette.text.primary,

          '--scalar-radius': '0px',
          '--scalar-radius-lg': '0px',
          '--scalar-radius-xl': '0px',

          '--scalar-shadow-1': 'none',
          '--scalar-shadow-2': 'none',
        },
        '& .scalar-app.scalar-app *': {
          fontFamily: '"Inter", "SF Pro", system-ui, sans-serif !important',
          borderRadius: '0 !important',
        },
        '& .scalar-app.scalar-app h1': {
          fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif !important',
          fontWeight: '400 !important',
          letterSpacing: '-0.02em',
          fontSize: '1.875rem !important',
        },
        '& .scalar-app.scalar-app h2': {
          fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif !important',
          fontWeight: '400 !important',
          letterSpacing: '-0.02em',
          fontSize: '1.5rem !important',
        },
        '& .scalar-app.scalar-app h3, & .scalar-app.scalar-app h4, & .scalar-app.scalar-app h5, & .scalar-app.scalar-app h6':
          {
            fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif !important',
            fontWeight: '400 !important',
            letterSpacing: '-0.01em',
          },
        '& .scalar-app.scalar-app code, & .scalar-app.scalar-app pre, & .scalar-app.scalar-app .font-code, & .scalar-app.scalar-app code *, & .scalar-app.scalar-app pre *, & .scalar-app.scalar-app .font-code *':
          {
            fontFamily: '"Geist Mono", "JetBrains Mono", monospace !important',
          },
      }}
    >
      <ApiReferenceReact
        key={darkModeState}
        configuration={{
          url: `${apiUrl}/v1/openapi.json`,
          forceDarkModeState: darkModeState,
          hideDarkModeToggle: true,
          withDefaultFonts: false,
          hideModels: true,
          layout: 'modern',
          agent: { disabled: true },
          hideDownloadButton: true,
        }}
      />
    </Box>
  );
}
