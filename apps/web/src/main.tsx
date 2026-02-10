import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { CssBaseline } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DrawerProvider } from './context/DrawerContext';
import { ThemeProvider } from './context/ThemeContext';
import { setupAppHeight } from './lib/mobile';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

import './index.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

setupAppHeight();

function InnerApp() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return <RouterProvider router={router} />;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <CssBaseline />
          <Toaster position="top-center" richColors />
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <DrawerProvider>
                <InnerApp />
              </DrawerProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
