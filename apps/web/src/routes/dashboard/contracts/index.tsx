import { createFileRoute } from '@tanstack/react-router';

import { ContractsListPage } from '@/components/contracts-list';

export const Route = createFileRoute('/dashboard/contracts/')({
  component: ContractsListPage,
});
