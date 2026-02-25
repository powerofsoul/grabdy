import { useEffect, useRef } from 'react';

import { Box, Button, Container, Typography } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { MockBrowserFrame } from './components/MockBrowserFrame';
import { SECTION_COPY } from './constants';

gsap.registerPlugin(ScrollTrigger);

export function WidgetShowcaseSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
        },
      });

      tl.from('.widget-copy', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.widget-browser', { y: 40, opacity: 0, duration: 0.7 }, '-=0.3');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{
        py: { xs: 8, md: 10 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            gap: { xs: 4, md: 6 },
          }}
        >
          {/* Left: Copy */}
          <Box className="widget-copy" sx={{ flex: { md: '0 0 40%' } }}>
            <Typography
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'primary.main',
                mb: 1.5,
              }}
            >
              {SECTION_COPY.overline}
            </Typography>
            <Typography
              variant="h3"
              sx={{
                mb: 2,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                fontWeight: 700,
              }}
            >
              {SECTION_COPY.title}
            </Typography>
            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: '1.05rem',
                lineHeight: 1.7,
                mb: 3,
              }}
            >
              {SECTION_COPY.description}
            </Typography>
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowRightIcon size={18} weight="light" />}
                sx={{ px: 4, py: 1.5 }}
              >
                {SECTION_COPY.cta}
              </Button>
            </Link>
          </Box>

          {/* Right: Mock browser */}
          <Box sx={{ flex: { md: '1 1 60%' }, minWidth: 0 }}>
            <MockBrowserFrame />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
