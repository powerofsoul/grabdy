import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { computeDashboardStats, type DashboardStats } from '../helpers';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const EMPTY_STATS: DashboardStats = {
  monthlyPayable: 0,
  monthlyReceivable: 0,
  expiredCount: 0,
  urgentCount: 0,
  typeBreakdown: [],
  renewalBreakdown: [],
  highValueExpiring: [],
  topCounterparties: [],
};

export function useDeadlines() {
  const { selectedOrgId } = useAuth();

  const {
    data: deadlinesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['deadlines', selectedOrgId],
    queryFn: () =>
      api.contracts.deadlines({
        params: { orgId: selectedOrgId ?? '' },
        query: { limit: 200 },
      }),
    enabled: !!selectedOrgId,
    refetchInterval: (query) => {
      const body = query.state.data?.status === 200 ? query.state.data.body : undefined;
      if (!body) return false;
      return body.data.metrics.processingSources > 0 ? 3000 : false;
    },
  });

  const deadlines = deadlinesData?.status === 200 ? deadlinesData.body.data : undefined;
  const metrics = deadlines?.metrics;

  const totalSources = metrics?.totalSources ?? 0;
  const processingSources = metrics?.processingSources ?? 0;

  const deadlineItems = deadlines?.deadlines;
  const stats = useMemo<DashboardStats>(
    () => (deadlineItems ? computeDashboardStats(deadlineItems) : EMPTY_STATS),
    [deadlineItems]
  );

  return {
    metrics,
    deadlines: deadlines?.deadlines,
    stats,
    isEmpty: !isLoading && totalSources === 0,
    isProcessing: processingSources > 0,
    isLoading,
    processingCount: processingSources,
    totalCount: totalSources,
    error,
  };
}
