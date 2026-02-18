import { useEffect, useRef } from 'react';

import { Box, Button, Container, Typography } from '@mui/material';
import { ArrowRightIcon, CheckIcon, ClockIcon, MinusIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from '@tanstack/react-router';

gsap.registerPlugin(ScrollTrigger);

interface Tier {
  name: string;
  price: string;
  priceSuffix: string;
  badge: string | null;
  description: string;
  cta: string;
  ctaVariant: 'contained' | 'outlined';
  comingSoon: boolean;
  highlighted: boolean;
  features: ReadonlyArray<{ label: string; value: string | boolean }>;
}

const TIERS = [
  {
    name: 'Pro',
    price: 'Beta',
    priceSuffix: '',
    badge: 'Free during beta',
    description:
      'Everything you need to get started. Free while we\u2019re in beta\u00a0\u2014\u00a0no credit card required.',
    cta: 'Get started',
    ctaVariant: 'contained',
    comingSoon: false,
    highlighted: true,
    features: [
      { label: 'Up to 3 team members', value: true },
      { label: 'Unlimited collections', value: true },
      { label: '100 data sources', value: true },
      { label: '150 MB per file', value: true },
      { label: '5 GB storage', value: true },
      { label: '10,000 API calls / mo (REST + MCP)', value: true },
      { label: 'REST API + Chat', value: true },
      { label: 'Canvas AI', value: true },
      { label: 'MCP server', value: true },
      { label: 'Slack bot', value: true },
      { label: 'Up to 5 integrations', value: true },
      { label: 'Analytics', value: true },
      { label: 'Email support', value: true },
    ],
  },
  {
    name: 'Business',
    price: 'Custom',
    priceSuffix: '',
    badge: 'Coming soon',
    description:
      'For growing teams that need higher limits, priority support, and advanced integrations.',
    cta: 'Get started',
    ctaVariant: 'outlined',
    comingSoon: true,
    highlighted: false,
    features: [
      { label: 'Up to 15 team members', value: true },
      { label: 'Unlimited collections', value: true },
      { label: '500 data sources', value: true },
      { label: '500 MB per file', value: true },
      { label: '25 GB storage', value: true },
      { label: '50,000 API calls / mo (REST + MCP)', value: true },
      { label: 'REST API + Chat', value: true },
      { label: 'Canvas AI', value: true },
      { label: 'MCP server', value: true },
      { label: 'Slack bot', value: true },
      { label: 'All integrations', value: true },
      { label: 'Advanced analytics', value: true },
      { label: 'Priority support', value: true },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    priceSuffix: '',
    badge: null,
    description:
      'Dedicated infrastructure, custom integrations, SLA, and hands-on onboarding for your team.',
    cta: 'Talk to us',
    ctaVariant: 'outlined',
    comingSoon: false,
    highlighted: false,
    features: [
      { label: 'Unlimited team members', value: true },
      { label: 'Unlimited collections', value: true },
      { label: 'Unlimited data sources', value: true },
      { label: 'Custom file size limits', value: true },
      { label: 'Custom storage', value: true },
      { label: 'Unlimited API calls (REST + MCP)', value: true },
      { label: 'REST API + Chat', value: true },
      { label: 'Canvas AI', value: true },
      { label: 'MCP server', value: true },
      { label: 'Slack bot', value: true },
      { label: 'Custom integrations', value: true },
      { label: 'Advanced analytics', value: true },
      { label: 'Dedicated support + SLA', value: true },
    ],
  },
] satisfies ReadonlyArray<Tier>;

function PricingCard({ tier }: { tier: Tier }) {
  return (
    <Box
      className="pricing-card"
      sx={{
        p: { xs: 3, md: 4 },
        border: '1px solid',
        borderColor: 'grey.900',
        borderTop: tier.highlighted ? '2px solid' : '1px solid',
        borderTopColor: tier.highlighted ? 'primary.main' : 'grey.900',
        bgcolor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: tier.comingSoon ? 0.7 : 1,
      }}
    >
      {tier.badge && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 24,
            transform: 'translateY(-50%)',
            bgcolor: tier.highlighted ? 'primary.main' : 'grey.800',
            color: tier.highlighted ? 'primary.contrastText' : 'text.secondary',
            px: 1.5,
            py: 0.25,
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          {tier.comingSoon && <ClockIcon size={11} weight="bold" color="currentColor" />}
          {tier.badge}
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {tier.name}
      </Typography>

      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            {tier.price}
          </Typography>
          {tier.priceSuffix && (
            <Typography variant="body2" color="text.secondary">
              {tier.priceSuffix}
            </Typography>
          )}
        </Box>
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ flex: 1, lineHeight: 1.6, fontSize: '0.85rem', mb: 3 }}
      >
        {tier.description}
      </Typography>

      <Link to="/auth/signup" style={{ textDecoration: 'none', width: '100%' }}>
        <Button
          variant={tier.ctaVariant}
          size="large"
          fullWidth
          endIcon={<ArrowRightIcon size={16} weight="light" color="currentColor" />}
          disabled={tier.comingSoon}
          sx={{ mb: 3, py: 1.25 }}
        >
          {tier.cta}
        </Button>
      </Link>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {tier.features.map((feature) => (
          <Box key={feature.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {feature.value === false ? (
              <MinusIcon size={16} weight="light" color="currentColor" style={{ opacity: 0.3 }} />
            ) : (
              <CheckIcon size={16} weight="light" color="currentColor" style={{ opacity: 0.6 }} />
            )}
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.82rem',
                color: feature.value === false ? 'text.disabled' : 'text.secondary',
              }}
            >
              {feature.label}
              {typeof feature.value === 'string' && (
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 500, ml: 0.5 }}>
                  {feature.value}
                </Box>
              )}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function PricingSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.pricing-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from(
        '.pricing-card',
        { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
        '-=0.3'
      );
      tl.from('.pricing-note', { opacity: 0, duration: 0.3 }, '-=0.1');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      id="pricing"
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          className="pricing-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: 1.5,
            fontSize: { xs: '2rem', md: '2.5rem' },
          }}
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

        {/* Pricing cards grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: { xs: 3, md: 2.5 },
            maxWidth: 1000,
            mx: 'auto',
            mb: { xs: 4, md: 5 },
          }}
        >
          {TIERS.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </Box>

        {/* Extra API calls note */}
        <Typography
          className="pricing-note"
          sx={{
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'text.secondary',
            mb: 1,
          }}
        >
          Need more API calls? Additional requests billed at usage-based rates.
        </Typography>
      </Container>
    </Box>
  );
}
