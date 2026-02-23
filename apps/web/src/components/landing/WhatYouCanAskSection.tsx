import { useCallback, useEffect, useRef, useState } from 'react';

import { alpha, Box, Container, IconButton, Typography, useTheme } from '@mui/material';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { GmailLogo, GoogleDriveLogo, LinearLogo, NotionLogo, SlackLogo } from './IntegrationLogos';

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
    preview:
      'The team agreed on a 15% increase for Pro plans, effective March 1. Decision in #product on Jan 12.',
  },
  {
    question: 'Show me all open blockers for the launch',
    sources: [
      { Logo: LinearLogo, name: 'Linear' },
      { Logo: SlackLogo, name: 'Slack' },
    ],
    preview:
      '3 blockers remain: auth migration (ENG-341), staging DNS (ENG-355), and copy review (ENG-360).',
  },
  {
    question: 'Summarize last quarter\u2019s customer feedback',
    sources: [
      { Logo: GmailLogo, name: 'Gmail' },
      { Logo: NotionLogo, name: 'Notion' },
    ],
    preview:
      'Top themes: onboarding speed (34%), pricing clarity (22%), and mobile experience (18%).',
  },
  {
    question: 'What does our refund policy say about digital products?',
    sources: [{ Logo: GoogleDriveLogo, name: 'Google Drive' }],
    preview:
      'Digital product refunds are processed within 5\u20137 business days. 30-day window from purchase.',
  },
] satisfies ReadonlyArray<QueryCard>;

const AUTO_ROTATE_MS = 5000;

export function WhatYouCanAskSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const autoRotateRef = useRef<ReturnType<typeof setTimeout>>();
  const userInteractedRef = useRef(false);
  const isInViewRef = useRef(false);

  const showCard = useCallback((idx: number) => {
    setActiveIndex(idx);
    setShowAnswer(false);
    setShowSources(false);

    setTimeout(() => setShowSources(true), 200);
    setTimeout(() => setShowAnswer(true), 400);
  }, []);

  const scheduleNextRef = useRef<(idx: number) => void>(() => {});

  const scheduleNext = useCallback(
    (idx: number) => {
      clearTimeout(autoRotateRef.current);
      autoRotateRef.current = setTimeout(() => {
        const next = (idx + 1) % QUERY_CARDS.length;
        showCard(next);
        scheduleNextRef.current(next);
      }, AUTO_ROTATE_MS);
    },
    [showCard]
  );

  useEffect(() => {
    scheduleNextRef.current = scheduleNext;
  }, [scheduleNext]);

  // Auto-rotation on viewport entry
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInViewRef.current) {
          isInViewRef.current = true;
          showCard(0);
          if (!prefersReducedMotion) {
            scheduleNext(0);
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      clearTimeout(autoRotateRef.current);
    };
  }, [showCard, scheduleNext]);

  const goTo = useCallback(
    (idx: number) => {
      userInteractedRef.current = true;
      clearTimeout(autoRotateRef.current);
      showCard(idx);
      // Resume auto-rotation after user interaction
      autoRotateRef.current = setTimeout(() => {
        const next = (idx + 1) % QUERY_CARDS.length;
        showCard(next);
        scheduleNext(next);
      }, AUTO_ROTATE_MS * 2);
    },
    [showCard, scheduleNext]
  );

  const goNext = useCallback(() => {
    goTo((activeIndex + 1) % QUERY_CARDS.length);
  }, [activeIndex, goTo]);

  const goPrev = useCallback(() => {
    goTo((activeIndex - 1 + QUERY_CARDS.length) % QUERY_CARDS.length);
  }, [activeIndex, goTo]);

  // Section entrance animation
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.wyca-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.wyca-showcase', { y: 25, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const activeCard = QUERY_CARDS[activeIndex];

  return (
    <Box
      ref={sectionRef}
      id="integrations"
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          className="wyca-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 7 },
            fontSize: { xs: '1.75rem', md: '2.75rem' },
            maxWidth: 700,
            mx: 'auto',
          }}
        >
          Questions your team asks every day, answered in seconds.
        </Typography>

        {/* Chat-style showcase */}
        <Box
          className="wyca-showcase"
          sx={{
            maxWidth: 600,
            mx: 'auto',
            mb: { xs: 4, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 220,
          }}
        >
          {/* User message bubble */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Box
              sx={{
                maxWidth: '80%',
                px: 2.5,
                py: 1.5,
                borderRadius: '18px 18px 4px 18px',
                bgcolor: alpha(ct, 0.08),
                minHeight: 44,
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  lineHeight: 1.5,
                  color: 'text.primary',
                }}
              >
                {activeCard.question}
              </Typography>
            </Box>
          </Box>

          {/* Assistant response bubble */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-start',
              opacity: showAnswer ? 1 : 0,
              transform: showAnswer ? 'translateY(0)' : 'translateY(12px)',
              transition: 'all 0.4s ease',
            }}
          >
            <Box
              sx={{
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderRadius: '18px 18px 18px 4px',
                  bgcolor: alpha(ct, 0.04),
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: '0.9rem', md: '0.95rem' },
                    color: 'text.secondary',
                    lineHeight: 1.7,
                  }}
                >
                  {activeCard.preview}
                </Typography>
              </Box>

              {/* Source pills */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  pl: 1,
                  opacity: showSources ? 1 : 0,
                  transform: showSources ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'all 0.3s ease 0.1s',
                }}
              >
                {activeCard.sources.map((src) => (
                  <Box
                    key={src.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: alpha(ct, 0.04),
                    }}
                  >
                    <src.Logo size={14} />
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {src.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Navigation: arrows + dots */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            onClick={goPrev}
            size="small"
            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
          >
            <CaretLeftIcon size={16} weight="light" />
          </IconButton>

          {QUERY_CARDS.map((_, i) => (
            <Box
              key={i}
              onClick={() => goTo(i)}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: i === activeIndex ? alpha(ct, 0.6) : alpha(ct, 0.12),
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': { bgcolor: alpha(ct, 0.3) },
              }}
            />
          ))}

          <IconButton
            onClick={goNext}
            size="small"
            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
          >
            <CaretRightIcon size={16} weight="light" />
          </IconButton>
        </Box>
      </Container>
    </Box>
  );
}
