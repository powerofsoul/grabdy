import { alpha, Box, Button, Chip, Divider, Typography, useTheme } from '@mui/material';
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  CodeIcon,
  CubeIcon,
  InfinityIcon,
  PlugIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { PageLoader } from '@/components/ui/PageLoader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const STATUS_CHIP_COLORS = {
  trial: 'default',
  active: 'success',
  past_due: 'warning',
  canceled: 'error',
  unpaid: 'error',
} as const satisfies Record<
  'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid',
  'default' | 'success' | 'warning' | 'error'
>;

const STATUS_LABELS = {
  trial: 'Trial',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
} as const satisfies Record<'trial' | 'active' | 'past_due' | 'canceled' | 'unpaid', string>;

const TRIAL_FEATURES = [
  { icon: CloudArrowUpIcon, label: 'Unlimited data sources' },
  { icon: CodeIcon, label: 'REST API and MCP access' },
  { icon: CubeIcon, label: 'Embeddable chatbot widget' },
  { icon: PlugIcon, label: 'All integrations' },
] as const;

export const Route = createFileRoute('/dashboard/billing')({
  component: BillingPage,
});

function BillingPage() {
  const { selectedOrgId } = useAuth();
  const theme = useTheme();

  const billingQuery = useQuery({
    queryKey: ['billing', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.billing.getStatus({ params: { orgId: selectedOrgId } });
      if (res.status === 200) return res.body.data;
      return null;
    },
    enabled: !!selectedOrgId,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) return null;
      const res = await api.billing.createPortalSession({
        params: { orgId: selectedOrgId },
        body: { returnUrl: window.location.href },
      });
      if (res.status === 200) return res.body.data.url;
      if (res.status === 400) throw new Error(res.body.error);
      throw new Error('Failed to open billing portal');
    },
    onSuccess: (url) => {
      if (url) window.location.href = url;
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal');
    },
  });

  const billing = billingQuery.data;
  const isTrial = !billing || billing.status === 'trial';

  return (
    <DashboardPage title="Billing" maxWidth={700}>
      {billingQuery.isLoading ? (
        <PageLoader />
      ) : isTrial ? (
        <Box>
          {/* Plan header */}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h5">Pro</Typography>
                <Chip label="Trial" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Full access, no time limit
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <InfinityIcon size={28} weight="light" color={theme.palette.text.primary} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                unlimited
              </Typography>
            </Box>
          </Box>

          {/* Features */}
          <Box sx={{ border: 1, borderTop: 0, borderColor: 'divider', p: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Included
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {TRIAL_FEATURES.map(({ icon: FeatureIcon, label }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FeatureIcon size={16} weight="light" color={theme.palette.text.secondary} />
                  <Typography variant="body2">{label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Upgrade note */}
          <Box
            sx={{
              border: 1,
              borderTop: 0,
              borderColor: 'divider',
              px: 3,
              py: 2,
              bgcolor: alpha(theme.palette.text.primary, 0.02),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Ready to upgrade? Contact our team to set up your subscription.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              endIcon={<ArrowSquareOutIcon size={14} weight="light" />}
              sx={{ flexShrink: 0 }}
            >
              {portalMutation.isPending ? 'Redirecting...' : 'Manage billing'}
            </Button>
          </Box>
        </Box>
      ) : billing ? (
        <Box>
          {/* Active plan header */}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <Typography variant="h5">{billing.planName ?? 'Pro'}</Typography>
                <Chip
                  label={STATUS_LABELS[billing.status]}
                  color={STATUS_CHIP_COLORS[billing.status]}
                  size="small"
                  icon={
                    billing.status === 'active' ? (
                      <CheckCircleIcon size={14} weight="fill" />
                    ) : (
                      <WarningCircleIcon size={14} weight="fill" />
                    )
                  }
                />
              </Box>
              {billing.currentPeriodEnd && (
                <Typography variant="body2" color="text.secondary">
                  Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Details */}
          <Box sx={{ border: 1, borderTop: 0, borderColor: 'divider', p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {billing.planName && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Plan
                  </Typography>
                  <Typography variant="body2">{billing.planName}</Typography>
                </Box>
              )}
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body2">{STATUS_LABELS[billing.status]}</Typography>
              </Box>
              {billing.currentPeriodEnd && (
                <>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Next billing date
                    </Typography>
                    <Typography variant="body2">
                      {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </Box>

          {/* Manage billing */}
          <Box
            sx={{
              border: 1,
              borderTop: 0,
              borderColor: 'divider',
              px: 3,
              py: 2,
              bgcolor: alpha(theme.palette.text.primary, 0.02),
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              size="small"
              variant="outlined"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              endIcon={<ArrowSquareOutIcon size={14} weight="light" />}
            >
              {portalMutation.isPending ? 'Redirecting...' : 'Manage billing'}
            </Button>
          </Box>
        </Box>
      ) : null}
    </DashboardPage>
  );
}
