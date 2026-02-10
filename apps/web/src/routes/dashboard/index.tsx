import { useEffect, useState } from 'react';

import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Database, FileText, FolderOpen, Key } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Stats {
  collections: number;
  dataSources: number;
  apiKeys: number;
}

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
});

function DashboardIndex() {
  const { user, selectedOrgId } = useAuth();
  const [stats, setStats] = useState<Stats>({ collections: 0, dataSources: 0, apiKeys: 0 });

  useEffect(() => {
    if (!selectedOrgId) return;

    const fetchStats = async () => {
      try {
        const [collectionsRes, sourcesRes, keysRes] = await Promise.all([
          api.collections.list({ params: { orgId: selectedOrgId } }),
          api.dataSources.list({ params: { orgId: selectedOrgId }, query: {} }),
          api.apiKeys.list({ params: { orgId: selectedOrgId } }),
        ]);

        setStats({
          collections: collectionsRes.status === 200 ? collectionsRes.body.data.length : 0,
          dataSources: sourcesRes.status === 200 ? sourcesRes.body.data.length : 0,
          apiKeys: keysRes.status === 200 ? keysRes.body.data.length : 0,
        });
      } catch {
        // Stats will remain at 0
      }
    };

    fetchStats();
  }, [selectedOrgId]);

  const statCards = [
    { label: 'Collections', value: stats.collections, icon: <FolderOpen size={24} /> },
    { label: 'Data Sources', value: stats.dataSources, icon: <Database size={24} /> },
    { label: 'API Keys', value: stats.apiKeys, icon: <Key size={24} /> },
    { label: 'Documents', value: stats.dataSources, icon: <FileText size={24} /> },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader title={`Welcome, ${user?.name}`} />

      <Grid container spacing={3}>
        {statCards.map((card, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
                <Box sx={{ color: 'primary.main' }}>{card.icon}</Box>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
