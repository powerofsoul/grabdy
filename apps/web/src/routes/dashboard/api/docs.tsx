import { Box, useTheme } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { ApiReferenceReact } from '@scalar/api-reference-react';
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
          },
        }}
      >
        <ApiReferenceReact
          key={darkModeState}
          configuration={{
            url: `${apiUrl}/api/v1/openapi.json`,
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
