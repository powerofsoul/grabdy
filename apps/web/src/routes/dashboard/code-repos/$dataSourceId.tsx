import { dbIdSchema } from '@grabdy/common';
import { Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { CodeRepoDocPages } from './CodeRepoDocPages';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/dashboard/code-repos/$dataSourceId')({
  component: CodeRepoDetailPage,
});

function CodeRepoDetailPage() {
  const { dataSourceId: rawDataSourceId } = Route.useParams();
  const { selectedOrgId } = useAuth();

  const parsed = dbIdSchema('DataSource').safeParse(rawDataSourceId);
  if (!parsed.success || !selectedOrgId) {
    return (
      <DashboardPage title="Code Repository">
        <Typography variant="body2" color="text.secondary">
          Invalid data source.
        </Typography>
      </DashboardPage>
    );
  }

  const dataSourceId = parsed.data;

  return <CodeRepoDocPages orgId={selectedOrgId} dataSourceId={dataSourceId} />;
}
