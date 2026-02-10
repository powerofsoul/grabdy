import { useEffect, useRef } from 'react';

import { Box, Container, Typography } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { BRAND_LOGOS, GmailLogo, GoogleDriveLogo, LinearLogo, NotionLogo, SlackLogo } from './IntegrationLogos';

gsap.registerPlugin(ScrollTrigger);

type LogoComponent = typeof SlackLogo;

interface QueryCard {
  question: string;
  sources: ReadonlyArray<{ Logo: LogoComponent; name: string }>;
  preview: string;
}

const QUERY_CARDS = [
  {
    question: 'What was decided about the pricing change?',
    sources: [
      { Logo: SlackLogo, name: 'Slack' },
      { Logo: GoogleDriveLogo, name: 'Google Drive' },
    ],
    preview: 'The team agreed on a 15% increase for Pro plans, effective March 1. Decision in #product on Jan 12.',
  },
  {
    question: 'Show me all open blockers for the launch',
    sources: [
      { Logo: LinearLogo, name: 'Linear' },
      { Logo: SlackLogo, name: 'Slack' },
    ],
    preview: '3 blockers remain: auth migration (ENG-341), staging DNS (ENG-355), and copy review (ENG-360).',
  },
  {
    question: 'Summarize last quarter\u2019s customer feedback',
    sources: [
      { Logo: GmailLogo, name: 'Gmail' },
      { Logo: NotionLogo, name: 'Notion' },
    ],
    preview: 'Top themes: onboarding speed (34%), pricing clarity (22%), and mobile experience (18%).',
  },
  {
    question: 'What does our refund policy say about digital products?',
    sources: [
      { Logo: GoogleDriveLogo, name: 'Google Drive' },
    ],
    preview: 'Digital product refunds are processed within 5\u20137 business days. 30-day window from purchase.',
  },
] satisfies ReadonlyArray<QueryCard>;

export function WhatYouCanAskSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.wyca-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.wyca-card', { y: 25, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '-=0.3');
      tl.from('.wyca-logos', { opacity: 0, duration: 0.5 }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: 'kindle.parchment',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          className="wyca-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 7 },
            fontWeight: 800,
            fontSize: { xs: '1.75rem', md: '2.5rem' },
            letterSpacing: '-0.02em',
            maxWidth: 700,
            mx: 'auto',
          }}
        >
          Questions your team asks every day — answered in seconds.
        </Typography>

        {/* Query cards — 2x2 grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 2, md: 2.5 },
            maxWidth: 900,
            mx: 'auto',
            mb: { xs: 5, md: 7 },
          }}
        >
          {QUERY_CARDS.map((card) => (
            <Box
              key={card.question}
              className="wyca-card"
              sx={{
                p: 3,
                borderRadius: 2,
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
                bgcolor: 'transparent',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 500,
                  fontSize: '1rem',
                  mb: 1.5,
                  lineHeight: 1.5,
                  color: 'text.primary',
                  fontFamily: '"Newsreader", "Georgia", serif',
                  fontStyle: 'italic',
                }}
              >
                {card.question}
              </Typography>

              {/* Source icons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                {card.sources.map((src) => (
                  <Box
                    key={src.name}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <src.Logo size={16} />
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {src.name}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Preview answer */}
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: 'text.secondary',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}
              >
                {card.preview}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Integration logo strip */}
        <Box
          className="wyca-logos"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {BRAND_LOGOS.map((brand) => (
              <Box key={brand.name} sx={{ opacity: 0.5 }}>
                <brand.Logo size={20} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Works with the tools you already use
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
