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
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 4, mb: 5 }}>
      <StatItem
        value={stats.collections}
        label="Sources"
        to="/dashboard/sources"
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
          description="Upload contracts, NDAs, compliance filings, and other documents."
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
          description="Ask questions via chat or embed a chatbot on your site."
        />
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
        title="Upload your documents"
        description="Upload contracts, NDAs, and other legal documents."
        completed={stats.collections > 0}
        completedLabel={`${stats.collections} source${stats.collections === 1 ? '' : 's'} created`}
        actions={[{ label: 'Upload files', to: '/dashboard/sources' }]}
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
        title="Ask your first question"
        description="Chat with your contract library."
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
      if (!selectedOrgId) return { collections: 0 };

      const collectionsRes = await api.collections.list({
        params: { orgId: selectedOrgId },
        query: {},
      });

      return {
        collections: collectionsRes.status === 200 ? collectionsRes.body.data.length : 0,
      };
    },
    enabled: !!selectedOrgId,
  });

  const resolved = stats ?? { collections: 0 };
  const isSetupComplete = !isLoading && resolved.collections > 0;

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
