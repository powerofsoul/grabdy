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
import { Activity, Cpu, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

interface DailyUsage {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ModelBreakdown {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface RequestTypeBreakdown {
  requestType: string;
  requests: number;
  totalTokens: number;
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
  const theme = useTheme();

  if (data.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No usage data yet</Typography>
      </Box>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.06)} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: alpha(theme.palette.text.primary, 0.4) }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: alpha(theme.palette.text.primary, 0.4) }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatNumber}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
            borderRadius: 8,
            fontSize: 13,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          formatter={(value) => [formatNumber(Number(value)), 'Tokens']}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          cursor={{ fill: alpha(theme.palette.text.primary, 0.04) }}
        />
        <Bar dataKey="totalTokens" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
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
      title="AI Usage"
      subtitle="Monitor your AI token consumption"
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
            <Grid size={{ xs: 6, md: 4 }}>
              <StatCard
                label="Total Requests"
                value={formatNumber(data.summary.totalRequests)}
                icon={<Activity size={20} />}
                color={p.primary.main}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <StatCard
                label="Total Tokens"
                value={formatNumber(data.summary.totalTokens)}
                icon={<Zap size={20} />}
                color={p.grey[600]}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <StatCard
                label="Input Tokens"
                value={formatNumber(data.summary.totalInputTokens)}
                icon={<Cpu size={20} />}
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

          {/* By Model */}
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Usage by Model
          </Typography>
          <MainTable
            data={data.byModel}
            headerNames={{
              model: 'Model',
              requests: 'Requests',
              tokens: 'Tokens',
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
            }}
            sorting={{
              sortableColumns: ['requests', 'tokens'] as const,
              defaultSort: 'requests',
              defaultDirection: 'desc',
              getSortValue: (row, col) => {
                if (col === 'requests') return row.requests;
                if (col === 'tokens') return row.totalTokens;
                return null;
              },
            }}
          />

          {/* By Request Type */}
          <Typography variant="h6" sx={{ fontWeight: 600, mt: 4, mb: 2 }}>
            Usage by Type
          </Typography>
          <MainTable
            data={data.byRequestType}
            headerNames={{
              type: 'Type',
              requests: 'Requests',
              tokens: 'Tokens',
            }}
            rowTitle={(row) => row.requestType}
            keyExtractor={(row) => row.requestType}
            renderItems={{
              type: (row) => row.requestType,
              requests: (row) => formatNumber(row.requests),
              tokens: (row) => formatNumber(row.totalTokens),
            }}
            sorting={{
              sortableColumns: ['requests', 'tokens'] as const,
              defaultSort: 'requests',
              defaultDirection: 'desc',
              getSortValue: (row, col) => {
                if (col === 'requests') return row.requests;
                if (col === 'tokens') return row.totalTokens;
                return null;
              },
            }}
          />
        </>
      )}
    </DashboardPage>
  );
}
