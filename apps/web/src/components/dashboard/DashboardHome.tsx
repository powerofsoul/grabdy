import { Box } from '@mui/material';

import { AttentionBanner } from './components/AttentionBanner';
import { AutoRenewalAlerts } from './components/AutoRenewalAlerts';
import { CounterpartyConcentration } from './components/CounterpartyConcentration';
import { EmptyState } from './components/EmptyState';
import { ExpiredBadge } from './components/ExpiredBadge';
import { HighValueExpiring } from './components/HighValueExpiring';
import { MetricsBar } from './components/MetricsBar';
import { ProcessingBanner } from './components/ProcessingBanner';
import { RenewalBreakdown } from './components/RenewalBreakdown';
import { UrgentAlerts } from './components/UrgentAlerts';
import { useDeadlines } from './hooks/useDeadlines';
import { formatCompactCurrency, getGreeting } from './helpers';

import { UploadProgressList } from '@/components/sources/components';
import { useBulkUpload } from '@/components/sources/hooks';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';

export function DashboardHome() {
  const { user, selectedOrgId } = useAuth();

  const { uploads, startUpload, dismissUploads, isUploading } = useBulkUpload(selectedOrgId, '');

  const {
    metrics,
    deadlines,
    stats,
    isEmpty,
    isProcessing,
    isLoading,
    processingCount,
    totalCount,
  } = useDeadlines();

  const handleFilesSelect = (files: File[]) => {
    startUpload(files);
  };

  const hasData = !isEmpty || isUploading;

  const futureDeadlines = (deadlines ?? []).filter((d) => d.daysLeft === null || d.daysLeft >= 0);

  return (
    <DashboardPage
      title={`${getGreeting()}, ${user?.firstName ?? ''}`}
      subtitle={
        isLoading
          ? ''
          : isEmpty && !isUploading
            ? 'Get started by uploading your first contracts.'
            : 'Here is an overview of your contract portfolio.'
      }
    >
      <UploadProgressList uploads={uploads} onDismiss={dismissUploads} />

      {isLoading ? (
        <PageLoader />
      ) : !hasData ? (
        <EmptyState onFilesSelect={handleFilesSelect} isUploading={isUploading} />
      ) : (
        <Box>
          {isProcessing && (
            <ProcessingBanner processingCount={processingCount} totalCount={totalCount} />
          )}

          <AttentionBanner urgentCount={stats.urgentCount} />

          <AutoRenewalAlerts deadlines={futureDeadlines} />

          <MetricsBar
            metrics={metrics}
            isLoading={false}
            portfolioValue={stats.portfolioValue}
            formatCurrency={formatCompactCurrency}
          />

          {/* Urgent deadlines + high value at risk */}
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              p: { xs: 2, md: 3 },
              mb: 4,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 3, md: 4 },
              }}
            >
              <Box>
                <UrgentAlerts deadlines={futureDeadlines.slice(0, 5)} />
                <ExpiredBadge expiredCount={stats.expiredCount} />
              </Box>

              <HighValueExpiring contracts={stats.highValueExpiring} />
            </Box>
          </Box>

          {/* Breakdowns row: renewal, counterparties */}
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              p: { xs: 2, md: 3 },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: { xs: 3, md: 4 },
              }}
            >
              <RenewalBreakdown breakdown={stats.renewalBreakdown} />
              <CounterpartyConcentration counterparties={stats.topCounterparties} />
            </Box>
          </Box>
        </Box>
      )}
    </DashboardPage>
  );
}
