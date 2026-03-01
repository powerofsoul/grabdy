import type { BillingStatus } from '@grabdy/contracts';
import { alpha, Box, Button, Chip, Divider, Link, Typography, useTheme } from '@mui/material';
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  CodeIcon,
  CubeIcon,
  InfinityIcon,
  PlugIcon,
  ReceiptIcon,
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
  none: 'default',
  active: 'success',
  past_due: 'warning',
  canceled: 'default',
  unpaid: 'error',
} as const satisfies Record<BillingStatus, 'default' | 'success' | 'warning' | 'error'>;

const STATUS_LABELS = {
  none: 'No subscription',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
} as const satisfies Record<BillingStatus, string>;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

const FREE_FEATURES = [
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
  const hasSubscription = billing && billing.status !== 'none';
  const invoices = billing?.invoices ?? [];

  if (billingQuery.isLoading) {
    return (
      <DashboardPage title="Billing" maxWidth={700}>
        <PageLoader />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title="Billing" maxWidth={700}>
      {hasSubscription ? (
        <Box>
          {/* Subscription card */}
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
              {billing.status === 'active' && billing.currentPeriodEnd && (
                <Typography variant="body2" color="text.secondary">
                  Renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </Typography>
              )}
              {billing.status === 'canceled' && (
                <Typography variant="body2" color="text.secondary">
                  This subscription has been canceled
                </Typography>
              )}
            </Box>
          </Box>

          {/* Details */}
          <Box sx={{ border: 1, borderTop: 0, borderColor: 'divider', p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {billing.planName && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Plan
                    </Typography>
                    <Typography variant="body2">{billing.planName}</Typography>
                  </Box>
                  <Divider />
                </>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Typography variant="body2">{STATUS_LABELS[billing.status]}</Typography>
              </Box>
              {billing.status === 'active' && billing.currentPeriodEnd && (
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
      ) : (
        <Box>
          {/* Free access header */}
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
                <Chip label="Free" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Full access to all features while we get to know each other
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <InfinityIcon size={28} weight="light" color={theme.palette.text.primary} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
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
              {FREE_FEATURES.map(({ icon: FeatureIcon, label }) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FeatureIcon size={16} weight="light" color={theme.palette.text.secondary} />
                  <Typography variant="body2">{label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Note */}
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
              Our team will reach out to set up your subscription when you are ready.
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
      )}

      {/* Invoices - always shown when available */}
      {invoices.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ReceiptIcon size={18} weight="light" color={theme.palette.text.secondary} />
            <Typography variant="subtitle2">Invoices</Typography>
          </Box>
          <Box sx={{ border: 1, borderColor: 'divider' }}>
            {invoices.map((invoice, i) => (
              <Box
                key={invoice.date}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 3,
                  py: 1.5,
                  borderTop: i > 0 ? 1 : 0,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
                    {new Date(invoice.date).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    label={invoice.status === 'paid' ? 'Paid' : 'Unpaid'}
                    size="small"
                    color={invoice.status === 'paid' ? 'success' : 'error'}
                  />
                  {invoice.url && (
                    <Link
                      href={invoice.url}
                      target="_blank"
                      rel="noopener"
                      variant="body2"
                      sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      View
                    </Link>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </DashboardPage>
  );
}
