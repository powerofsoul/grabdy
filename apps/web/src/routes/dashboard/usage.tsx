import { useCallback, useEffect, useState } from 'react';

import {
  alpha,
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Activity, Cpu, DollarSign, Zap } from 'lucide-react';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface DailyUsage {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

interface ModelBreakdown {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

interface RequestTypeBreakdown {
  requestType: string;
  requests: number;
  totalTokens: number;
  cost: number;
}

interface UsageData {
  summary: UsageSummary;
  daily: DailyUsage[];
  byModel: ModelBreakdown[];
  byRequestType: RequestTypeBreakdown[];
}

export const Route = createFileRoute('/dashboard/usage')({
  component: UsagePage,
});

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: alpha(color, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </Box>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
            {value}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

function DailyChart({ data }: { data: DailyUsage[] }) {
  if (data.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No usage data yet</Typography>
      </Box>
    );
  }

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120 }}>
      {data.map((day) => {
        const height = (day.totalTokens / maxTokens) * 100;
        const dateLabel = new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return (
          <Box
            key={day.date}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: 24,
                height: `${Math.max(height, 2)}%`,
                bgcolor: 'primary.main',
                borderRadius: '4px 4px 0 0',
                minHeight: 2,
              }}
            />
            <Typography
              sx={{ fontSize: '0.6rem', color: 'text.secondary', writingMode: 'vertical-rl', height: 40 }}
              noWrap
            >
              {dateLabel}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function UsagePage() {
  const theme = useTheme();
  const { selectedOrgId } = useAuth();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchUsage = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const res = await api.analytics.getUsageSummary({
        params: { orgId: selectedOrgId },
        query: { days },
      });
      if (res.status === 200) {
        setData(res.body.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, days]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const p = theme.palette;

  return (
    <DashboardPage
      title="Usage"
      subtitle="Monitor your AI usage and costs"
      actions={
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={days}
            label="Period"
            onChange={(e) => setDays(e.target.value as number)}
          >
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </Select>
        </FormControl>
      }
    >

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {data && (
        <>
          {/* Summary cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Total Requests"
                value={formatNumber(data.summary.totalRequests)}
                icon={<Activity size={20} />}
                color={p.primary.main}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Total Tokens"
                value={formatNumber(data.summary.totalTokens)}
                icon={<Zap size={20} />}
                color={p.grey[600]}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Input Tokens"
                value={formatNumber(data.summary.totalInputTokens)}
                icon={<Cpu size={20} />}
                color={p.grey[600]}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                label="Total Cost"
                value={formatCost(data.summary.totalCost)}
                icon={<DollarSign size={20} />}
                color={p.grey[600]}
              />
            </Grid>
          </Grid>

          {/* Daily usage chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                Daily Token Usage
              </Typography>
              <DailyChart data={data.daily} />
            </CardContent>
          </Card>

          {/* Breakdowns */}
          <Grid container spacing={2}>
            {/* By Model */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Card>
                <CardContent>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                    Usage by Model
                  </Typography>
                  {data.byModel.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">No data</Typography>
                  ) : (
                    <MainTable
                      data={data.byModel}
                      headerNames={{
                        model: 'Model',
                        requests: 'Requests',
                        tokens: 'Tokens',
                        cost: 'Cost',
                      }}
                      rowTitle={(row) => row.model}
                      keyExtractor={(row) => row.model}
                      renderItems={{
                        model: (row) => (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {row.model}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.provider}
                            </Typography>
                          </Box>
                        ),
                        requests: (row) => formatNumber(row.requests),
                        tokens: (row) => formatNumber(row.totalTokens),
                        cost: (row) => formatCost(row.cost),
                      }}
                      sorting={{
                        sortableColumns: ['requests', 'tokens', 'cost'] as const,
                        defaultSort: 'requests',
                        defaultDirection: 'desc',
                        getSortValue: (row, col) => {
                          if (col === 'requests') return row.requests;
                          if (col === 'tokens') return row.totalTokens;
                          if (col === 'cost') return row.cost;
                          return null;
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* By Request Type */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Card>
                <CardContent>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 2 }}>
                    Usage by Type
                  </Typography>
                  {data.byRequestType.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">No data</Typography>
                  ) : (
                    <MainTable
                      data={data.byRequestType}
                      headerNames={{
                        type: 'Type',
                        requests: 'Requests',
                        cost: 'Cost',
                      }}
                      rowTitle={(row) => row.requestType}
                      keyExtractor={(row) => row.requestType}
                      renderItems={{
                        type: (row) => row.requestType,
                        requests: (row) => formatNumber(row.requests),
                        cost: (row) => formatCost(row.cost),
                      }}
                      sorting={{
                        sortableColumns: ['requests', 'cost'] as const,
                        defaultSort: 'requests',
                        defaultDirection: 'desc',
                        getSortValue: (row, col) => {
                          if (col === 'requests') return row.requests;
                          if (col === 'cost') return row.cost;
                          return null;
                        },
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </DashboardPage>
  );
}
