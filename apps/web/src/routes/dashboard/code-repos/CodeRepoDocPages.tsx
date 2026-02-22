import type { DbId } from '@grabdy/common';
import { Box, CircularProgress, Typography } from '@mui/material';

import { DocPagesLayout } from '@/components/code-repos';
import { useIndexingStatus } from '@/components/code-repos/hooks/useIndexingStatus';
import { DashboardPage } from '@/components/ui/DashboardPage';

export function CodeRepoDocPages({
  orgId,
  dataSourceId,
}: {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
}) {
  const { status, loading } = useIndexingStatus(orgId, dataSourceId);

  if (loading) {
    return (
      <DashboardPage noPadding>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress size={28} />
        </Box>
      </DashboardPage>
    );
  }

  if (!status || status.status !== 'READY') {
    return (
      <DashboardPage title="Code Repository">
        <Typography variant="body2" color="text.secondary">
          Repository is not ready yet.
        </Typography>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage noPadding>
      <DocPagesLayout
        orgId={orgId}
        dataSourceId={dataSourceId}
        repoName={status.repoFullName}
      />
    </DashboardPage>
  );
}
