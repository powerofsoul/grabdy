import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { CssBaseline } from '@mui/material';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { DrawerProvider } from './context/DrawerContext';
import { ThemeProvider } from './context/ThemeContext';
import { setupAppHeight } from './lib/mobile';
import { queryClient } from './lib/query-client';
import { App } from './App';

import './index.css';

setupAppHeight();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
createRoot(rootEl).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
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
    </GoogleOAuthProvider>
  </StrictMode>
);
