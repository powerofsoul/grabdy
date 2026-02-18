import { useEffect, useRef } from 'react';

import { alpha, Box, Button, Container, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon, CheckIcon, ClockIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from '@tanstack/react-router';

import { SlackLogo } from './IntegrationLogos';

gsap.registerPlugin(ScrollTrigger);

interface Tier {
  name: string;
  price: string;
  description: string;
  cta: string;
  ctaVariant: 'contained' | 'outlined';
  comingSoon: boolean;
  highlighted: boolean;
}

const TIERS = [
  {
    name: 'Pro',
    price: 'Beta',
    description: 'Everything you need to get started. No credit card required.',
    cta: 'Get started',
    ctaVariant: 'contained',
    comingSoon: false,
    highlighted: true,
  },
  {
    name: 'Business',
    price: 'Custom',
    description: 'Higher limits, priority support, and advanced integrations.',
    cta: 'Get started',
    ctaVariant: 'outlined',
    comingSoon: true,
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Dedicated infrastructure, custom integrations, and SLA.',
    cta: 'Talk to us',
    ctaVariant: 'outlined',
    comingSoon: false,
    highlighted: false,
  },
] satisfies ReadonlyArray<Tier>;

interface FeatureRow {
  label: string;
  icon?: 'slack';
  values: [string | true, string | true, string | true];
}

const FEATURES = [
  { label: 'Team members', values: ['Up to 3', 'Up to 15', 'Unlimited'] },
  { label: 'Collections', values: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Data sources', values: ['100', '500', 'Unlimited'] },
  { label: 'File size', values: ['150 MB', '500 MB', 'Custom'] },
  { label: 'Storage', values: ['5 GB', '25 GB', 'Custom'] },
  { label: 'API calls / mo', values: ['10,000', '50,000', 'Custom'] },
  { label: 'REST API + Chat', values: [true, true, true] },
  { label: 'Canvas AI', values: [true, true, true] },
  { label: 'MCP server', values: [true, true, true] },
  { label: 'Slack bot', icon: 'slack', values: [true, true, true] },
  { label: 'Integrations', values: ['Up to 5', 'All', 'Custom'] },
  { label: 'Analytics', values: ['Basic', 'Advanced', 'Advanced'] },
  { label: 'Support', values: ['Email', 'Priority', 'Dedicated + SLA'] },
] satisfies ReadonlyArray<FeatureRow>;

function CellValue({ value, muted }: { value: string | true; muted: boolean }) {
  if (value === true) {
    return (
      <CheckIcon
        size={15}
        weight="bold"
        color="currentColor"
        style={{ opacity: muted ? 0.25 : 0.45 }}
      />
    );
  }

  return (
    <Typography
      variant="body2"
      sx={{
        fontSize: '0.8rem',
        fontWeight: 500,
        color: muted ? 'text.disabled' : 'text.primary',
      }}
    >
      {value}
    </Typography>
  );
}

function FeatureLabel({ row }: { row: FeatureRow }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {row.icon === 'slack' && <SlackLogo size={14} />}
      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
        {row.label}
      </Typography>
    </Box>
  );
}

export function PricingSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.pricing-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.pricing-table', { y: 30, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
      tl.from('.pricing-note', { opacity: 0, duration: 0.3 }, '-=0.1');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      id="pricing"
      sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        <Typography
          className="pricing-title"
          variant="h2"
          sx={{ textAlign: 'center', mb: 1.5, fontSize: { xs: '2rem', md: '2.5rem' } }}
        >
          Simple pricing, no surprises.
        </Typography>
        <Typography
          className="pricing-title"
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: { xs: 5, md: 7 }, fontSize: '1.05rem' }}
        >
          Pro is free while we&apos;re in beta. No credit card needed.
        </Typography>

        {/* ── Mobile: stacked cards ── */}
        <Box
          className="pricing-table"
          sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 3, mb: 4 }}
        >
          {TIERS.map((tier, tierIdx) => (
            <Box
              key={tier.name}
              sx={{
                border: '1px solid',
                borderColor: 'grey.900',
                borderTop: tier.highlighted ? '2px solid' : '1px solid',
                borderTopColor: tier.highlighted ? 'primary.main' : 'grey.900',
                opacity: tier.comingSoon ? 0.6 : 1,
              }}
            >
              {/* Card header */}
              <Box sx={{ p: 3, pb: 2.5 }}>
                {tier.highlighted && (
                  <Typography
                    sx={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'primary.main',
                      mb: 1,
                    }}
                  >
                    Free during beta
                  </Typography>
                )}
                {tier.comingSoon && (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'text.secondary',
                      mb: 1,
                    }}
                  >
                    <ClockIcon size={10} weight="bold" color="currentColor" />
                    Coming soon
                  </Box>
                )}
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {tier.name}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '2rem', mt: 0.5, mb: 1 }}>
                  {tier.price}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem', mb: 2 }}>
                  {tier.description}
                </Typography>
                <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
                  <Button
                    variant={tier.ctaVariant}
                    size="large"
                    fullWidth
                    endIcon={<ArrowRightIcon size={14} weight="light" color="currentColor" />}
                    disabled={tier.comingSoon}
                    sx={{ py: 1.25 }}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </Box>
              {/* Features list */}
              <Box sx={{ px: 3, pb: 3 }}>
                {FEATURES.map((row) => (
                  <Box
                    key={row.label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderTop: '1px solid',
                      borderColor: 'grey.900',
                    }}
                  >
                    <FeatureLabel row={row} />
                    <CellValue value={row.values[tierIdx]} muted={tier.comingSoon} />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* ── Desktop: comparison table ── */}
        <Box
          className="pricing-table"
          sx={{
            display: { xs: 'none', md: 'block' },
            maxWidth: 920,
            mx: 'auto',
            mb: 5,
            border: '1px solid',
            borderColor: 'grey.900',
          }}
        >
          {/* Header row with pattern background */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr repeat(3, 1fr)',
              borderBottom: '1px solid',
              borderColor: 'grey.900',
              position: 'relative',
              backgroundImage: `radial-gradient(${alpha(ct, 0.06)} 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          >
            {/* Empty label column — logo/branding */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                px: 3,
                pb: 3,
              }}
            >
              <Typography variant="h5" sx={{ fontSize: 20, color: 'text.primary' }}>
                grabdy.
              </Typography>
            </Box>

            {/* Tier columns */}
            {TIERS.map((tier) => (
              <Box
                key={tier.name}
                sx={{
                  px: 3,
                  py: 3.5,
                  borderLeft: '1px solid',
                  borderColor: 'grey.900',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: tier.comingSoon ? 0.55 : 1,
                  ...(tier.highlighted && {
                    borderTop: '2px solid',
                    borderTopColor: 'primary.main',
                    mt: '-1px',
                  }),
                }}
              >
                {/* Badge area — fixed height so content below aligns */}
                <Box sx={{ minHeight: 22, mb: 1, display: 'flex', alignItems: 'center' }}>
                  {tier.highlighted && (
                    <Typography
                      sx={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'primary.main',
                      }}
                    >
                      Free during beta
                    </Typography>
                  )}
                  {tier.comingSoon && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'text.secondary',
                      }}
                    >
                      <ClockIcon size={10} weight="bold" color="currentColor" />
                      Coming soon
                    </Box>
                  )}
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.25 }}>
                  {tier.name}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '2rem', mb: 1 }}>
                  {tier.price}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '0.8rem', lineHeight: 1.5, mb: 2.5, flex: 1 }}
                >
                  {tier.description}
                </Typography>
                <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
                  <Button
                    variant={tier.ctaVariant}
                    size="medium"
                    fullWidth
                    endIcon={<ArrowRightIcon size={14} weight="light" color="currentColor" />}
                    disabled={tier.comingSoon}
                    sx={{ py: 1 }}
                  >
                    {tier.cta}
                  </Button>
                </Link>
              </Box>
            ))}
          </Box>

          {/* Feature rows */}
          {FEATURES.map((row, rowIdx) => (
            <Box
              key={row.label}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr repeat(3, 1fr)',
                alignItems: 'center',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: 'action.hover' },
                ...(rowIdx > 0 && {
                  borderTop: '1px solid',
                  borderColor: 'grey.900',
                }),
              }}
            >
              <Box sx={{ px: 3, py: 1.25 }}>
                <FeatureLabel row={row} />
              </Box>

              {row.values.map((value, idx) => (
                <Box
                  key={TIERS[idx].name}
                  sx={{
                    px: 3,
                    py: 1.25,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderLeft: '1px solid',
                    borderColor: 'grey.900',
                  }}
                >
                  <CellValue value={value} muted={TIERS[idx].comingSoon} />
                </Box>
              ))}
            </Box>
          ))}
        </Box>

        <Typography
          className="pricing-note"
          sx={{ textAlign: 'center', fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}
        >
          Need more API calls? Additional requests billed at usage-based rates.
        </Typography>
      </Container>
    </Box>
  );
}
