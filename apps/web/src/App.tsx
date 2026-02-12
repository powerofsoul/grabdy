import { createRouter, RouterProvider } from '@tanstack/react-router';

import { NotFound } from './components/ui/NotFound';
import { useAuth } from './context/AuthContext';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree, defaultNotFoundComponent: NotFound });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return <RouterProvider router={router} />;
}
