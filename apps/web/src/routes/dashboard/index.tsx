import { createFileRoute } from '@tanstack/react-router';

import { DashboardHome } from '@/components/dashboard';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
});
