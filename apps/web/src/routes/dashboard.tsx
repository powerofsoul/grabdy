import { Box } from '@mui/material';
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';

import { Sidebar } from '@/components/ui/Sidebar';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, selectedOrgId, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  if (!user || !selectedOrgId) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <Sidebar />
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
