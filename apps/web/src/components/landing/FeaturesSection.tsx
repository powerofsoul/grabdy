import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { GmailLogo, GoogleDriveLogo, NotionLogo } from './IntegrationLogos';

gsap.registerPlugin(ScrollTrigger);

type LogoComponent = typeof GoogleDriveLogo;

interface UseCase {
  emoji: string;
  role: string;
  question: string;
  answer: string;
  sources: ReadonlyArray<{ Logo: LogoComponent; label: string }>;
}

const USE_CASES = [
  {
    emoji: '\uD83D\uDCC5',
    role: 'Renewal deadlines',
    question: 'When does the Acme MSA auto-renew, and what is the notice period?',
    answer:
      'Auto-renews on Sept 15, 2026. 90-day written notice required to terminate. Current term is 3 years from execution date.',
    sources: [
      { Logo: GoogleDriveLogo, label: 'acme-msa-2023.pdf' },
      { Logo: NotionLogo, label: 'Vendor Tracker' },
    ],
  },
  {
    emoji: '\uD83D\uDCCB',
    role: 'Compliance tracking',
    question: 'Which vendor BAAs expire this quarter?',
    answer:
      'Three BAAs expire before June 30: Datadog (May 12), Snowflake (June 1), and AWS (June 28). All require 30-day renewal notice.',
    sources: [
      { Logo: GoogleDriveLogo, label: 'vendor-baas/' },
      { Logo: GmailLogo, label: 'Compliance inbox' },
    ],
  },
  {
    emoji: '\uD83D\uDD0D',
    role: 'Clause lookup',
    question: 'What is the indemnification cap in the Contoso deal?',
    answer:
      'Mutual indemnification capped at 2x annual fees. Carve-outs for IP infringement and data breach are uncapped per Section 9.3.',
    sources: [{ Logo: GoogleDriveLogo, label: 'contoso-saas-agreement.pdf' }],
  },
  {
    emoji: '\uD83D\uDD04',
    role: 'Term comparison',
    question: 'Did the new AWS terms change anything material from last year?',
    answer:
      'Liability cap reduced from 12 months to 6 months of fees. New arbitration clause added in Section 11. Data residency terms unchanged.',
    sources: [
      { Logo: GoogleDriveLogo, label: 'aws-enterprise-2025.pdf' },
      { Logo: GoogleDriveLogo, label: 'aws-enterprise-2024.pdf' },
    ],
  },
] satisfies ReadonlyArray<UseCase>;

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      className="usecase-card"
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 3,
        bgcolor: alpha(ct, 0.03),
        transition: 'background-color 0.2s ease',
        '&:hover': {
          bgcolor: alpha(ct, 0.05),
        },
      }}
    >
      {/* Role badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{useCase.emoji}</Typography>
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {useCase.role}
        </Typography>
      </Box>

      {/* Question */}
      <Typography
        sx={{
          fontSize: { xs: '0.95rem', md: '1.05rem' },
          fontWeight: 600,
          color: 'text.primary',
          lineHeight: 1.4,
          mb: 1.5,
        }}
      >
        {useCase.question}
      </Typography>

      {/* Answer */}
      <Typography
        sx={{
          fontSize: '0.88rem',
          color: 'text.secondary',
          lineHeight: 1.7,
          mb: 2,
        }}
      >
        {useCase.answer}
      </Typography>

      {/* Sources */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {useCase.sources.map((s) => (
          <Box
            key={s.label}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.375,
              borderRadius: 1,
              bgcolor: alpha(ct, 0.05),
            }}
          >
            <s.Logo size={12} />
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: 'text.secondary',
                lineHeight: 1.3,
              }}
            >
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.features-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.features-subtitle', { y: 20, opacity: 0, duration: 0.5 }, '-=0.3');
      tl.from(
        '.usecase-card',
        {
          y: 30,
          opacity: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: 'power2.out',
        },
        '-=0.2'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      id="features"
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Typography
            className="features-title"
            variant="overline"
            sx={{
              mb: 1.5,
              display: 'block',
              color: 'text.secondary',
            }}
          >
            Use cases
          </Typography>
          <Typography
            className="features-title"
            variant="h2"
            sx={{
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
            }}
          >
            Ask your contracts anything.
          </Typography>
          <Typography
            className="features-subtitle"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.9rem', md: '1rem' },
              lineHeight: 1.6,
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            General counsel ask complex questions across hundreds of agreements. Grabdy finds the
            answer and cites the exact clause.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 2, md: 2 },
            maxWidth: 860,
            mx: 'auto',
          }}
        >
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.role} useCase={uc} />
          ))}
        </Box>
      </Container>
    </Box>
  );
}
