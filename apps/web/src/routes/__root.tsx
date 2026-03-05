import { Box } from '@mui/material';
import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router';

import { NotFound } from '@/components/ui/NotFound';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HeadContent />
      <Outlet />
    </Box>
  );
}
