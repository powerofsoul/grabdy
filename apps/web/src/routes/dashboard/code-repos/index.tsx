import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/code-repos/')({
  component: () => <Navigate to="/dashboard/integrations/$provider" params={{ provider: 'github' }} replace />,
});
