import { useEffect, useRef } from 'react';

import { Box, Button, Container, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

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
        py: { xs: 10, md: 14 },
        position: 'relative',
        bgcolor: 'background.default',
      }}
    >

      <Container maxWidth="sm" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Typography
          className="cta-title"
          variant="h2"
          sx={{
            fontWeight: 800,
            mb: 2,
            fontSize: { xs: '2rem', md: '2.75rem' },
            letterSpacing: '-0.02em',
          }}
        >
          Ready when you are.
        </Typography>
        <Typography
          className="cta-subtitle"
          sx={{ mb: 5, color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.6 }}
        >
          Create a free account. Connect your tools. Ask your first question.
          <br />
          That&apos;s the whole process.
        </Typography>

        <Box className="cta-button" sx={{ mb: 2 }}>
          <Link to="/auth/register" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowRight size={18} />}
              sx={{
                px: 6,
                py: 1.75,
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              Try Grabdy Free
            </Button>
          </Link>
        </Box>

        <Box className="cta-note" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            No credit card · 2-minute setup · Free for teams under 10
          </Typography>
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
