import { useCallback, useEffect, useState } from 'react';

import {
  alpha,
  Box,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

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
            border: `1px solid ${theme.palette.grey[900]}`,
            borderRadius: 0,
            fontSize: 13,
            boxShadow: 'none',
          }}
          formatter={(value) => [formatNumber(Number(value)), 'Tokens']}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          cursor={{ fill: alpha(theme.palette.text.primary, 0.04) }}
        />
        <Bar dataKey="totalTokens" fill={theme.palette.text.primary} radius={0} maxBarSize={32} />
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

  const ct = theme.palette.text.primary;

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
          {/* Summary — floating mono numbers with separators */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 4, mb: 4 }}>
            <Box>
              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '3rem',
                  fontWeight: 400,
                  lineHeight: 1,
                  letterSpacing: '0.05em',
                  color: 'text.primary',
                }}
              >
                {formatNumber(data.summary.totalRequests)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Total Requests
              </Typography>
            </Box>
            <Box sx={{ width: '1px', height: 40, bgcolor: alpha(ct, 0.15) }} />
            <Box>
              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '3rem',
                  fontWeight: 400,
                  lineHeight: 1,
                  letterSpacing: '0.05em',
                  color: 'text.primary',
                }}
              >
                {formatNumber(data.summary.totalTokens)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Total Tokens
              </Typography>
            </Box>
            <Box sx={{ width: '1px', height: 40, bgcolor: alpha(ct, 0.15) }} />
            <Box>
              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '3rem',
                  fontWeight: 400,
                  lineHeight: 1,
                  letterSpacing: '0.05em',
                  color: 'text.primary',
                }}
              >
                {formatNumber(data.summary.totalInputTokens)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Input Tokens
              </Typography>
            </Box>
          </Box>

          {/* Daily usage chart */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Daily Token Usage
            </Typography>
            <DailyChart data={data.daily} />
          </Box>

          {/* By Model */}
          <Typography variant="h6" sx={{ mb: 2 }}>
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
              requests: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.requests)}
                </Typography>
              ),
              tokens: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.totalTokens)}
                </Typography>
              ),
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
          <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
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
              requests: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.requests)}
                </Typography>
              ),
              tokens: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.totalTokens)}
                </Typography>
              ),
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
