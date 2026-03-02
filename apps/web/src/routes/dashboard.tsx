import { Box, keyframes, Typography } from '@mui/material';
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';

import { BackgroundWatermark } from '@/components/ui/BackgroundWatermark';
import { MobileSidebarProvider, Sidebar } from '@/components/ui/Sidebar';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, selectedOrgId, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          bgcolor: 'background.default',
          gap: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: 28,
            color: 'text.primary',
            animation: `${keyframes`0%, 100% { opacity: 1 } 50% { opacity: 0.3 }`} 1.5s ease-in-out infinite`,
          }}
        >
          grabdy.
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          Waking up the hamsters...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  if (!user || !selectedOrgId) {
    return null;
  }

  return (
    <MobileSidebarProvider>
      <Box sx={{ display: 'flex', height: '100%' }}>
        <Sidebar />
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <Outlet />
        </Box>
        <BackgroundWatermark />
      </Box>
    </MobileSidebarProvider>
  );
}
