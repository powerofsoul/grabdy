import { dbIdSchema } from '@grabdy/common';
import { createFileRoute, Navigate } from '@tanstack/react-router';

import { ContractDetailPage } from '@/components/contracts';

export const Route = createFileRoute('/dashboard/contracts/$contractId')({
  component: ContractRoute,
});

function ContractRoute() {
  const { contractId } = Route.useParams();
  const parsed = dbIdSchema('Contract').safeParse(contractId);
  if (!parsed.success) {
    return <Navigate to="/dashboard/contracts" />;
  }
  return <ContractDetailPage contractId={parsed.data} />;
}
