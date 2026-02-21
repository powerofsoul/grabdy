import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import {
  GmailLogo,
  GoogleDriveLogo,
  LinearLogo,
  NotionLogo,
  SlackLogo,
} from './IntegrationLogos';

gsap.registerPlugin(ScrollTrigger);

type LogoComponent = typeof SlackLogo;

interface UseCase {
  emoji: string;
  role: string;
  question: string;
  answer: string;
  sources: ReadonlyArray<{ Logo: LogoComponent; label: string }>;
}

const USE_CASES = [
  {
    emoji: '\uD83D\uDCC9',
    role: 'Sales',
    question: 'What discount did we give Acme Corp last time?',
    answer:
      '15% multi-year discount on Enterprise, approved by VP Sales on March 12. Price-lock through 2026.',
    sources: [
      { Logo: GoogleDriveLogo, label: 'acme-renewal.pdf' },
      { Logo: SlackLogo, label: '#sales-deals' },
    ],
  },
  {
    emoji: '\uD83D\uDEE0\uFE0F',
    role: 'Engineering',
    question: 'How do we validate JWT tokens?',
    answer:
      'AuthGuard extracts the Bearer token, verifies with RS256 via JWKS endpoint, attaches decoded user to request context.',
    sources: [
      { Logo: NotionLogo, label: 'Auth Architecture' },
      { Logo: SlackLogo, label: '#backend' },
    ],
  },
  {
    emoji: '\uD83D\uDC4B',
    role: 'New hires',
    question: 'How do I deploy to production?',
    answer:
      'Merge to main triggers CI. Deploy captain approves Vercel preview, then promotes to prod. Rollback via git revert.',
    sources: [
      { Logo: GoogleDriveLogo, label: 'deploy-runbook.md' },
      { Logo: LinearLogo, label: 'ENG-102' },
    ],
  },
  {
    emoji: '\uD83D\uDCAC',
    role: 'Support',
    question: 'What are customers saying about the new dashboard?',
    answer:
      'Top requests: faster load times (14x), exportable charts (9x), dark mode (7x). NPS dropped 3 points post-rollout.',
    sources: [
      { Logo: GmailLogo, label: 'Q1 feedback' },
      { Logo: SlackLogo, label: '#customer-feedback' },
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
            One question. Cited answer.
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
            Every team asks questions across scattered tools. Grabdy finds the answer and shows you
            exactly where it came from.
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
