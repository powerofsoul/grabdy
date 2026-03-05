import { Box } from '@mui/material';

import { MetricCard } from './MetricCard';

interface Metrics {
  totalActive: number;
  totalCounterparties: number;
  expiringThisQuarter: number;
  needNoticeThisMonth: number;
}

interface MetricsBarProps {
  metrics: Metrics | undefined;
  isLoading: boolean;
  monthlyPayable: number;
  monthlyReceivable: number;
  formatCurrency: (n: number) => string;
}

export function MetricsBar({
  metrics,
  isLoading,
  monthlyPayable,
  monthlyReceivable,
  formatCurrency,
}: MetricsBarProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
        gap: { xs: 1, sm: 2 },
        mb: 4,
      }}
    >
      <MetricCard
        value={metrics?.totalActive ?? 0}
        label="Active contracts"
        isLoading={isLoading}
      />
      <MetricCard
        value={metrics?.totalCounterparties ?? 0}
        label="Counterparties"
        isLoading={isLoading}
      />
      <MetricCard
        value={metrics?.expiringThisQuarter ?? 0}
        label="Expiring this quarter"
        isLoading={isLoading}
      />
      <MetricCard
        value={metrics?.needNoticeThisMonth ?? 0}
        label="Need notice this month"
        isLoading={isLoading}
      />
      <MetricCard
        value={monthlyPayable}
        label="Monthly payable"
        isLoading={isLoading}
        format={formatCurrency}
      />
      <MetricCard
        value={monthlyReceivable}
        label="Monthly receivable"
        isLoading={isLoading}
        format={formatCurrency}
      />
    </Box>
  );
}
