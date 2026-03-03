import { alpha, Box, Divider, Skeleton, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

interface Stats {
  collections: number;
  apiKeys: number;
  connections: number;
}

export const Route = createFileRoute('/dashboard/')({
  component: DashboardIndex,
});

function QuickAction({ label, to }: { label: string; to: string }) {
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
        <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{label}</Typography>
        <ArrowRightIcon size={14} weight="light" color="currentColor" />
      </Box>
    </Link>
  );
}

function StepAction({ label, to }: { label: string; to: string }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.25,
          cursor: 'pointer',
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.2),
          transition: 'border-color 0.15s',
          '&:hover': { borderColor: ct },
        }}
      >
        <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{label}</Typography>
        <ArrowRightIcon size={14} weight="light" color="currentColor" />
      </Box>
    </Link>
  );
}

function StepRow({
  number,
  title,
  description,
  completed,
  completedLabel,
  actions,
}: {
  number: number;
  title: string;
  description: string;
  completed: boolean;
  completedLabel?: string;
  actions: Array<{ label: string; to: string }>;
}) {
  const theme = useTheme();

  return (
    <Box sx={{ py: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: '0.875rem',
            color: 'text.secondary',
            lineHeight: 1.7,
            minWidth: 20,
          }}
        >
          {number}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{ fontSize: '0.9375rem', fontWeight: 500, color: 'text.primary', mb: 0.5 }}
          >
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            {description}
          </Typography>
          {completed && completedLabel ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CheckCircleIcon size={16} weight="fill" color={theme.palette.success.main} />
              <Typography variant="body2" sx={{ color: 'success.main' }}>
                {completedLabel}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
              {actions.map((action) => (
                <StepAction key={action.to} label={action.label} to={action.to} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function StatItem({
  value,
  label,
  to,
  isLoading,
}: {
  value: number;
  label: string;
  to: string;
  isLoading: boolean;
}) {
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Box sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>
        {isLoading ? (
          <Skeleton variant="text" width={48} sx={{ fontSize: '3rem', lineHeight: 1 }} />
        ) : (
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
            {value}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {label}
        </Typography>
      </Box>
    </Link>
  );
}

function StatsBar({ stats, isLoading }: { stats: Stats; isLoading: boolean }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 4, mb: 5 }}>
      <StatItem
        value={stats.collections}
        label="Sources"
        to="/dashboard/sources"
        isLoading={isLoading}
      />
      <Box sx={{ width: '1px', height: 40, bgcolor: alpha(ct, 0.15) }} />
      <StatItem
        value={stats.connections}
        label="Integrations"
        to="/dashboard/integrations"
        isLoading={isLoading}
      />
      <Box sx={{ width: '1px', height: 40, bgcolor: alpha(ct, 0.15) }} />
      <StatItem
        value={stats.apiKeys}
        label="API Keys"
        to="/dashboard/api/keys"
        isLoading={isLoading}
      />
    </Box>
  );
}

function HowItWorksStep({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.secondary', mb: 0.25 }}
      >
        {title}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled' }}>{description}</Typography>
    </Box>
  );
}

function HowItWorks() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ mt: 5 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 2,
          display: 'block',
        }}
      >
        How to use
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <HowItWorksStep
          title="Add your data"
          description="Upload files or connect integrations like Slack and GitHub."
        />
        <Typography
          sx={{
            color: 'text.disabled',
            fontSize: '0.875rem',
            mt: 0.25,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {'\u2192'}
        </Typography>
        <HowItWorksStep
          title="Organize into sources"
          description="Group related data into sources so you can query them separately."
        />
        <Typography
          sx={{
            color: 'text.disabled',
            fontSize: '0.875rem',
            mt: 0.25,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {'\u2192'}
        </Typography>
        <HowItWorksStep
          title="Query your data"
          description="Ask questions via chat, REST API, or MCP server."
        />
      </Box>
      <Box sx={{ mt: 2 }}>
        <Link to="/dashboard/api/docs" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              py: 0.25,
              cursor: 'pointer',
              borderBottom: '1px solid',
              borderColor: alpha(ct, 0.2),
              transition: 'border-color 0.15s',
              '&:hover': { borderColor: ct },
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              Read the docs
            </Typography>
            <ArrowRightIcon size={12} weight="light" />
          </Box>
        </Link>
      </Box>
    </Box>
  );
}

function GettingStarted({ stats, isLoading }: { stats: Stats; isLoading: boolean }) {
  return (
    <Box>
      <StatsBar stats={stats} isLoading={isLoading} />
      <StepRow
        number={1}
        title="Connect your data"
        description="Link an integration or upload files."
        completed={stats.connections > 0}
        completedLabel={`${stats.connections} integration${stats.connections === 1 ? '' : 's'} connected`}
        actions={[
          { label: 'Connect integration', to: '/dashboard/integrations' },
          { label: 'Upload files', to: '/dashboard/sources' },
        ]}
      />
      <Divider />
      <StepRow
        number={2}
        title="Create a source"
        description="Organize uploaded files into collections."
        completed={stats.collections > 0}
        completedLabel={`${stats.collections} source${stats.collections === 1 ? '' : 's'} created`}
        actions={[{ label: 'Create source', to: '/dashboard/sources' }]}
      />
      <Divider />
      <StepRow
        number={3}
        title="Generate an API key"
        description="Access your data via REST API or MCP."
        completed={stats.apiKeys > 0}
        completedLabel={`${stats.apiKeys} API key${stats.apiKeys === 1 ? '' : 's'} created`}
        actions={[{ label: 'Generate key', to: '/dashboard/api/keys' }]}
      />
      <Divider />
      <StepRow
        number={4}
        title="Ask your first question"
        description="Chat with your knowledge base."
        completed={false}
        actions={[{ label: 'Open chat', to: '/dashboard/chat' }]}
      />

      <HowItWorks />
    </Box>
  );
}

function Overview({ stats, isLoading }: { stats: Stats; isLoading: boolean }) {
  return (
    <>
      <StatsBar stats={stats} isLoading={isLoading} />

      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 1.5,
          display: 'block',
        }}
      >
        Quick actions
      </Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <QuickAction label="Create a source" to="/dashboard/sources" />
        <QuickAction label="Connect integration" to="/dashboard/integrations" />
        <QuickAction label="Generate an API key" to="/dashboard/api/keys" />
        <QuickAction label="Ask a question" to="/dashboard/chat" />
      </Box>
    </>
  );
}

function DashboardIndex() {
  const { user, selectedOrgId } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return { collections: 0, apiKeys: 0, connections: 0 };

      const [collectionsRes, keysRes, connectionsRes] = await Promise.all([
        api.collections.list({ params: { orgId: selectedOrgId }, query: {} }),
        api.apiKeys.list({ params: { orgId: selectedOrgId } }),
        api.integrations.listConnections({ params: { orgId: selectedOrgId } }),
      ]);

      return {
        collections: collectionsRes.status === 200 ? collectionsRes.body.data.length : 0,
        apiKeys: keysRes.status === 200 ? keysRes.body.data.length : 0,
        connections: connectionsRes.status === 200 ? connectionsRes.body.data.length : 0,
      };
    },
    enabled: !!selectedOrgId,
  });

  const resolved = stats ?? { collections: 0, apiKeys: 0, connections: 0 };
  const isSetupComplete = !isLoading && resolved.collections > 0 && resolved.apiKeys > 0;

  return (
    <DashboardPage
      title={`Welcome back, ${user?.firstName ?? ''}`}
      subtitle={
        isLoading
          ? ''
          : isSetupComplete
            ? "Here's what's happening in your workspace"
            : "Let's get your workspace set up."
      }
    >
      {isSetupComplete ? (
        <Overview stats={resolved} isLoading={isLoading} />
      ) : (
        <GettingStarted stats={resolved} isLoading={isLoading} />
      )}
    </DashboardPage>
  );
}
