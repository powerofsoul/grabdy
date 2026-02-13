import { useEffect, useState } from 'react';

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Key, ChatCircle, Plus } from '@phosphor-icons/react';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

interface Stats {
  collections: number;
  apiKeys: number;
}

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
});

function QuickAction({
  label,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
}) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.5,
          cursor: 'pointer',
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.2),
          transition: 'border-color 0.15s',
          '&:hover': { borderColor: ct },
        }}
      >
        <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>
          {label}
        </Typography>
        <ArrowRight size={14} weight="light" color="currentColor" />
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

  const ct = theme.palette.text.primary;

  return (
    <DashboardPage
      title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`}
      subtitle="Here's what's happening in your workspace"
    >
      {/* Stat display — floating mono numbers */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 4, mb: 5 }}>
        <Link to="/dashboard/sources" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Box sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: '3rem',
                fontWeight: 400,
                lineHeight: 1,
                letterSpacing: '0.02em',
                color: 'text.primary',
              }}
            >
              {stats.collections}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sources
            </Typography>
          </Box>
        </Link>
        <Box sx={{ width: '1px', height: 40, bgcolor: alpha(ct, 0.15) }} />
        <Link to="/dashboard/api/keys" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Box sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: '3rem',
                fontWeight: 400,
                lineHeight: 1,
                letterSpacing: '0.02em',
                color: 'text.primary',
              }}
            >
              {stats.apiKeys}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              API Keys
            </Typography>
          </Box>
        </Link>
      </Box>

      {/* Quick Actions — underlined text links */}
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5, display: 'block' }}>
        Quick actions
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <QuickAction
          icon={<Plus size={14} weight="light" color="currentColor" />}
          label="Create a source"
          description=""
          to="/dashboard/sources"
        />
        <QuickAction
          icon={<Key size={14} weight="light" color="currentColor" />}
          label="Generate an API key"
          description=""
          to="/dashboard/api/keys"
        />
        <QuickAction
          icon={<ChatCircle size={14} weight="light" color="currentColor" />}
          label="Ask a question"
          description=""
          to="/dashboard/chat"
        />
      </Box>
    </DashboardPage>
  );
}
