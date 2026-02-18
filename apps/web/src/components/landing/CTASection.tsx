import { useEffect, useRef } from 'react';

import { Box, Button, Container, Typography } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from '@tanstack/react-router';

gsap.registerPlugin(ScrollTrigger);

export function CTASection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
        },
      });

      tl.from('.cta-title', { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' });
      tl.from('.cta-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');
      tl.from('.cta-button', { y: 20, opacity: 0, duration: 0.4, ease: 'back.out(1.5)' }, '-=0.2');
      tl.from('.cta-note', { opacity: 0, duration: 0.3 }, '-=0.1');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{
        py: { xs: 12, md: 16 },
        position: 'relative',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Typography
          className="cta-title"
          variant="h2"
          sx={{
            mb: 2,
            fontSize: { xs: '2rem', md: '2.75rem' },
          }}
        >
          Your team&apos;s knowledge, one question away.
        </Typography>
        <Typography
          className="cta-subtitle"
          sx={{ mb: 1.5, color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.6 }}
        >
          Get started for free. No credit card required.
        </Typography>
        <Typography
          className="cta-subtitle"
          sx={{ mb: 5, color: 'text.secondary', fontSize: '0.85rem' }}
        >
          Teams from startups to enterprises already use Grabdy.
        </Typography>

        <Box
          className="cta-button"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'center',
            gap: 2,
            mb: 2,
          }}
        >
          <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowRightIcon size={18} weight="light" color="currentColor" />}
              sx={{
                px: 6,
                py: 1.75,
                fontSize: '1.05rem',
              }}
            >
              Get Started
            </Button>
          </Link>
        </Box>

        <Box
          className="cta-note"
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
        >
          <Typography
            component="a"
            href="mailto:hello@grabdy.com"
            sx={{
              fontSize: '0.85rem',
              color: 'text.secondary',
              textDecoration: 'none',
              transition: 'color 0.2s',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Need a demo for your team? Talk to us &rarr;
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
