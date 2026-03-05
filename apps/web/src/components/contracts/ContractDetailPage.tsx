import type { DbId } from '@grabdy/common';
import { Box, Typography } from '@mui/material';

import { DocumentPreviewPanel } from './components/DocumentPreviewPanel';
import { MetadataSidebar } from './components/MetadataSidebar';
import { useContract } from './hooks/useContract';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';

interface ContractDetailPageProps {
  contractId: DbId<'Contract'>;
}

export function ContractDetailPage({ contractId }: ContractDetailPageProps) {
  const { contract, isLoading } = useContract(contractId);

  if (isLoading) {
    return (
      <DashboardPage title="" showBack>
        <PageLoader />
      </DashboardPage>
    );
  }

  if (!contract) {
    return (
      <DashboardPage title="Contract not found" showBack>
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">This contract could not be found.</Typography>
        </Box>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title={contract.title} showBack noPadding maxWidth={false}>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            flex: '0 0 60%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <DocumentPreviewPanel dataSourceId={contract.dataSourceId} />
        </Box>
        <Box
          sx={{
            flex: '0 0 40%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <MetadataSidebar contract={contract} />
        </Box>
      </Box>
    </DashboardPage>
  );
}
