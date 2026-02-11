import { createRouter, RouterProvider } from '@tanstack/react-router';

import { useAuth } from './context/AuthContext';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

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
