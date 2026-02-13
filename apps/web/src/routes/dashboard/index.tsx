import { useEffect, useState } from 'react';

import { alpha, Box, Card, CardActionArea, CardContent, Grid, Typography, useTheme } from '@mui/material';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, FolderOpen, Key, MessageSquare, Plus } from 'lucide-react';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Stats {
  collections: number;
  apiKeys: number;
}

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
});

function StatCard({
  label,
  value,
  icon,
  to,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to: string;
  color: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <Card sx={{ height: '100%' }}>
        <CardActionArea sx={{ height: '100%' }}>
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
        </CardActionArea>
      </Card>
    </Link>
  );
}

function QuickAction({
  icon,
  label,
  description,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'border-color 0.15s, background-color 0.15s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.50' },
        }}
      >
        <Box sx={{ color: 'text.secondary', flexShrink: 0 }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 500, fontSize: '0.875rem' }}>{label}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
            {description}
          </Typography>
        </Box>
        <ArrowRight size={16} style={{ opacity: 0.3, flexShrink: 0 }} />
      </Box>
    </Link>
  );
}

function DashboardIndex() {
  const theme = useTheme();
  const { user, selectedOrgId } = useAuth();
  const [stats, setStats] = useState<Stats>({ collections: 0, apiKeys: 0 });

  useEffect(() => {
    if (!selectedOrgId) return;

    const fetchStats = async () => {
      try {
        const [collectionsRes, keysRes] = await Promise.all([
          api.collections.list({ params: { orgId: selectedOrgId } }),
          api.apiKeys.list({ params: { orgId: selectedOrgId } }),
        ]);

        setStats({
          collections: collectionsRes.status === 200 ? collectionsRes.body.data.length : 0,
          apiKeys: keysRes.status === 200 ? keysRes.body.data.length : 0,
        });
      } catch {
        // Stats will remain at 0
      }
    };

    fetchStats();
  }, [selectedOrgId]);

  const p = theme.palette;

  return (
    <DashboardPage
      title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`}
      subtitle="Here's what's happening in your workspace"
    >
      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatCard
            label="Sources"
            value={stats.collections}
            icon={<FolderOpen size={20} />}
            to="/dashboard/sources"
            color={p.primary.main}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatCard
            label="API Keys"
            value={stats.apiKeys}
            icon={<Key size={20} />}
            to="/dashboard/api/keys"
            color={p.grey[600]}
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1.5, color: 'text.secondary' }}>
        Quick actions
      </Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAction
            icon={<Plus size={18} />}
            label="Create a source"
            description="Organize your data into searchable groups"
            to="/dashboard/sources"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAction
            icon={<Key size={18} />}
            label="Generate an API key"
            description="Connect your app to Grabdy"
            to="/dashboard/api/keys"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <QuickAction
            icon={<MessageSquare size={18} />}
            label="Ask a question"
            description="Chat with your documents"
            to="/dashboard/chat"
          />
        </Grid>
      </Grid>
    </DashboardPage>
  );
}
