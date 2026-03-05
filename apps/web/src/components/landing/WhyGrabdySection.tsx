import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import {
  BrainIcon,
  ClockCountdownIcon,
  CurrencyDollarIcon,
  EyeIcon,
  ListChecksIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const BENEFITS = [
  {
    Icon: ClockCountdownIcon,
    title: 'Eliminate missed deadlines',
    description:
      'Legal teams lose thousands of hours tracking contract dates in spreadsheets. Grabdy extracts every expiration date, notice period, and renewal window automatically.',
  },
  {
    Icon: CurrencyDollarIcon,
    title: 'Prevent costly auto-renewals',
    description:
      'The average enterprise wastes $1.5M per year on unwanted auto-renewals. Get alerts before notice deadlines pass so you can renegotiate or terminate on your terms.',
  },
  {
    Icon: EyeIcon,
    title: 'Full portfolio visibility',
    description:
      'See your entire contract portfolio in one dashboard. Active contracts, total value at risk, counterparty concentration, and upcoming deadlines at a glance.',
  },
  {
    Icon: BrainIcon,
    title: 'AI-powered contract search',
    description:
      'Ask questions about indemnification caps, termination rights, or payment terms in plain English. Every answer cites the exact clause and page number.',
  },
  {
    Icon: ListChecksIcon,
    title: 'Automated metadata extraction',
    description:
      'No more manual data entry. Grabdy reads every page and extracts contract type, counterparty name, effective dates, total value, and renewal terms.',
  },
  {
    Icon: UsersThreeIcon,
    title: 'Built for legal teams',
    description:
      'Multi-user organizations with role-based access. General counsel, paralegals, and finance teams all see the same source of truth for contract data.',
  },
] as const;

export function WhyGrabdySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.why-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from(
        '.why-card',
        { y: 25, opacity: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' },
        '-=0.3'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Typography
            className="why-title"
            variant="overline"
            sx={{ mb: 1.5, display: 'block', color: 'text.secondary' }}
          >
            Why Grabdy
          </Typography>
          <Typography
            className="why-title"
            variant="h2"
            sx={{
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
            }}
          >
            Contract management that actually works.
          </Typography>
          <Typography
            className="why-title"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.9rem', md: '1rem' },
              lineHeight: 1.6,
              maxWidth: 560,
              mx: 'auto',
            }}
          >
            Legal teams at growing companies use Grabdy to replace manual contract tracking with
            AI-powered deadline intelligence and portfolio analytics.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {BENEFITS.map((benefit) => (
            <Box
              key={benefit.title}
              className="why-card"
              sx={{
                p: 3,
                border: '1px solid',
                borderColor: alpha(ct, 0.08),
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: alpha(ct, 0.15) },
              }}
            >
              <benefit.Icon size={22} weight="light" style={{ marginBottom: 12, opacity: 0.7 }} />
              <Typography
                sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.75, color: 'text.primary' }}
              >
                {benefit.title}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', lineHeight: 1.7 }}>
                {benefit.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
