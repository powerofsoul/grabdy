import { useState } from 'react';

import {
  alpha,
  Box,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

export const Route = createFileRoute('/dashboard/usage')({
  component: UsagePage,
});

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface DailyUsage {
  date: string;
  totalTokens: number;
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

const statSx = {
  fontFamily: FONT_MONO,
  fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
  fontWeight: 400,
  lineHeight: 1,
  letterSpacing: '0.05em',
  color: 'text.primary',
};

function UsagePage() {
  const { selectedOrgId } = useAuth();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['usage', selectedOrgId, days],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.analytics.getUsageSummary({
        params: { orgId: selectedOrgId },
        query: { days },
      });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedOrgId,
  });

  return (
    <DashboardPage
      title="AI Usage"
      subtitle="Monitor your AI token consumption"
      actions={
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select value={days} label="Period" onChange={(e) => setDays(e.target.value as number)}>
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
          </Select>
        </FormControl>
      }
    >
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {data && (
        <>
          {/* Summary stats */}
          <Stack
            direction="row"
            sx={{
              mb: 4,
              gap: { xs: 2, sm: 3, md: 4 },
              flexWrap: 'wrap',
              alignItems: 'baseline',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={statSx}>{formatNumber(data.summary.totalRequests)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Total Requests
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={statSx}>{formatNumber(data.summary.totalTokens)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Total Tokens
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={statSx}>{formatNumber(data.summary.totalInputTokens)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Input Tokens
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={statSx}>{formatNumber(data.summary.totalOutputTokens)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Output Tokens
              </Typography>
            </Box>
          </Stack>

          {/* Daily usage chart */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Daily Token Usage
            </Typography>
            <DailyChart data={data.daily} />
          </Box>

          {/* By Member */}
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Usage by Member
          </Typography>
          <MainTable
            data={data.byMember}
            headerNames={{
              member: 'Member',
              requests: 'Requests',
              input: 'Input',
              output: 'Output',
              total: 'Total',
            }}
            rowTitle={(row) => row.userName}
            keyExtractor={(row) => row.userId ?? 'system'}
            renderItems={{
              member: (row) => (
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.userName}
                </Typography>
              ),
              requests: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.requests)}
                </Typography>
              ),
              input: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.inputTokens)}
                </Typography>
              ),
              output: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.outputTokens)}
                </Typography>
              ),
              total: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.totalTokens)}
                </Typography>
              ),
            }}
            sorting={{
              sortableColumns: ['requests', 'input', 'output', 'total'] as const,
              defaultSort: 'total',
              defaultDirection: 'desc',
              getSortValue: (row, col) => {
                if (col === 'requests') return row.requests;
                if (col === 'input') return row.inputTokens;
                if (col === 'output') return row.outputTokens;
                if (col === 'total') return row.totalTokens;
                return null;
              },
            }}
          />

          {/* By Source */}
          <Typography variant="subtitle1" sx={{ mt: 4, mb: 2 }}>
            Usage by Channel
          </Typography>
          <MainTable
            data={data.bySource}
            headerNames={{
              source: 'Channel',
              requests: 'Requests',
              input: 'Input',
              output: 'Output',
              total: 'Total',
            }}
            rowTitle={(row) => row.source}
            keyExtractor={(row) => row.source}
            renderItems={{
              source: (row) => (
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.source}
                </Typography>
              ),
              requests: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.requests)}
                </Typography>
              ),
              input: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.inputTokens)}
                </Typography>
              ),
              output: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.outputTokens)}
                </Typography>
              ),
              total: (row) => (
                <Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>
                  {formatNumber(row.totalTokens)}
                </Typography>
              ),
            }}
            sorting={{
              sortableColumns: ['requests', 'input', 'output', 'total'] as const,
              defaultSort: 'total',
              defaultDirection: 'desc',
              getSortValue: (row, col) => {
                if (col === 'requests') return row.requests;
                if (col === 'input') return row.inputTokens;
                if (col === 'output') return row.outputTokens;
                if (col === 'total') return row.totalTokens;
                return null;
              },
            }}
          />
        </>
      )}
    </DashboardPage>
  );
}
