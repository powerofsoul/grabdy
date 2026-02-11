import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { CssBaseline } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { DrawerProvider } from './context/DrawerContext';
import { ThemeProvider } from './context/ThemeContext';
import { setupAppHeight } from './lib/mobile';
import { queryClient } from './lib/query-client';

import './index.css';

setupAppHeight();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CssBaseline />
        <ErrorBoundary>
          <AuthProvider>
            <DrawerProvider>
              <Toaster
                position="top-right"
                toastOptions={{
                  style: {
                    borderRadius: '10px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    border: 'none',
                  },
                }}
              />
              <App />
            </DrawerProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
