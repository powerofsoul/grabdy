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
                closeButton
                toastOptions={{
                  style: {
                    borderRadius: '0',
                    boxShadow: 'none',
                    border: '1px solid var(--border-color)',
                    fontFamily: '"Inter", "SF Pro", system-ui, sans-serif',
                    fontSize: '0.84rem',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)',
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
