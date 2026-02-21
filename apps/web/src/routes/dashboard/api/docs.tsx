import { Box, useTheme } from '@mui/material';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import { createFileRoute } from '@tanstack/react-router';

import '@scalar/api-reference-react/style.css';

import { DashboardPage } from '@/components/ui/DashboardPage';

export const Route = createFileRoute('/dashboard/api/docs')({
  component: ApiDocsPage,
});

function ApiDocsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const darkModeState = isDark ? 'dark' : 'light';

  return (
    <DashboardPage title="API Docs" noPadding maxWidth={false}>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          '& .scalar-api-reference': {
            position: 'absolute',
            inset: 0,
            overflow: 'auto',

            // Fonts only — let Scalar keep its own colors
            '--scalar-font': '"Inter", "SF Pro", system-ui, sans-serif',
            '--scalar-font-code': '"Geist Mono", "JetBrains Mono", monospace',

            // Sync background with theme
            '--scalar-background-1': theme.palette.background.default,
            '--scalar-background-2': theme.palette.background.paper,
            '--scalar-background-3': isDark
              ? theme.palette.grey[800]
              : theme.palette.grey[100],
            '--scalar-sidebar-background-1': theme.palette.background.default,
            '--scalar-sidebar-color-1': theme.palette.text.primary,
            '--scalar-sidebar-color-2': theme.palette.text.secondary,
            '--scalar-sidebar-search-background': isDark
              ? theme.palette.grey[100]
              : theme.palette.grey[200],
            '--scalar-sidebar-search-border-color': theme.palette.divider,
            '--scalar-sidebar-search-color': theme.palette.text.primary,

            // No border radius
            '--scalar-radius': '0px',
            '--scalar-radius-lg': '0px',
            '--scalar-radius-xl': '0px',

            // No shadows
            '--scalar-shadow-1': 'none',
            '--scalar-shadow-2': 'none',
          },
          // Force Inter on everything, no border-radius
          '& .scalar-app.scalar-app *': {
            fontFamily: '"Inter", "SF Pro", system-ui, sans-serif !important',
            borderRadius: '0 !important',
          },
          // Headings get Instrument Serif
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
          // Code gets Geist Mono
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
    </DashboardPage>
  );
}
