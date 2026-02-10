import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from './api';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      skipToast?: boolean;
      successMessage?: string;
      errorMessage?: string;
    };
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('offline') ||
      message.includes('internet')
    );
  }
  return false;
}

function getStatusCode(error: unknown): number | null {
  if (error instanceof ApiError) {
    return error.status;
  }
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection.';
  }

  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'You do not have permission to perform this action';
    }
    if (error.status === 429) {
      return 'Too many actions. Please slow down and try again.';
    }
    if (error.status === 404) {
      return 'The requested resource was not found';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later';
    }
    return error.message;
  }

  return 'Internal Server Error. Contact support.';
}

function shouldRedirectToLogin(error: unknown): boolean {
  const status = getStatusCode(error);
  if (status !== 401) return false;

  const currentPath = window.location.pathname;
  const authPaths = ['/auth/login', '/auth/register', '/auth/forgot-password'];
  return !authPaths.some((path) => currentPath.startsWith(path));
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (shouldRedirectToLogin(error)) {
        window.location.href = '/auth/login';
        return;
      }

      if (query.state.data !== undefined) {
        toast.error(getErrorMessage(error));
      }
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.successMessage && !mutation.meta?.skipToast) {
        toast.success(mutation.meta.successMessage);
      }
    },
    onError: (error, _variables, _context, mutation) => {
      if (shouldRedirectToLogin(error)) {
        window.location.href = '/auth/login';
        return;
      }

      if (mutation.meta?.skipToast) return;

      const message = mutation.meta?.errorMessage || getErrorMessage(error);
      toast.error(message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        const status = getStatusCode(error);
        if (status === 401 || status === 403 || status === 404 || status === 429) {
          return false;
        }
        if (isNetworkError(error)) {
          return failureCount < 1;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
