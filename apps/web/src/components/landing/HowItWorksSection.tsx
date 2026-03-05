import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import { CloudArrowUpIcon, MagnifyingGlassIcon, ShieldWarningIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    Icon: CloudArrowUpIcon,
    number: '01',
    title: 'Upload your contracts',
    description:
      'Drag and drop PDFs, Word documents, or plain text files. Grabdy accepts vendor agreements, NDAs, employment contracts, leases, SOWs, BAAs, and compliance filings. Bulk upload entire folders at once.',
  },
  {
    Icon: MagnifyingGlassIcon,
    number: '02',
    title: 'AI reads every page',
    description:
      'Grabdy automatically extracts expiration dates, renewal terms, notice periods, counterparties, contract types, and total values. No manual data entry, no spreadsheets, no missed clauses buried on page 47.',
  },
  {
    Icon: ShieldWarningIcon,
    number: '03',
    title: 'Stay ahead of every deadline',
    description:
      'Your dashboard shows which contracts need attention, which auto-renewals are approaching, and where your highest-value risk sits. Get alerts before notice deadlines pass so you never get locked into an unwanted renewal.',
  },
] as const;

export function HowItWorksSection() {
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

      tl.from('.hiw-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from(
        '.hiw-step',
        { y: 30, opacity: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out' },
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
            className="hiw-title"
            variant="overline"
            sx={{ mb: 1.5, display: 'block', color: 'text.secondary' }}
          >
            How it works
          </Typography>
          <Typography
            className="hiw-title"
            variant="h2"
            sx={{
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
            }}
          >
            From upload to insight in minutes.
          </Typography>
          <Typography
            className="hiw-title"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.9rem', md: '1rem' },
              lineHeight: 1.6,
              maxWidth: 540,
              mx: 'auto',
            }}
          >
            No implementation project, no training sessions. Upload your first contract and see
            results immediately.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
            gap: { xs: 3, md: 4 },
            maxWidth: 960,
            mx: 'auto',
          }}
        >
          {STEPS.map((step) => (
            <Box
              key={step.number}
              className="hiw-step"
              sx={{
                p: 3,
                border: '1px solid',
                borderColor: alpha(ct, 0.08),
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: alpha(ct, 0.15) },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <step.Icon size={22} weight="light" />
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'primary.main',
                    letterSpacing: '0.04em',
                  }}
                >
                  {step.number}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, color: 'text.primary' }}>
                {step.title}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.7 }}>
                {step.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
