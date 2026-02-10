import { useEffect, useRef } from 'react';

import { Box, Container, Typography } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { number: '8', label: 'integrations searched simultaneously' },
  { number: '<800ms', label: 'average response time' },
  { number: '100%', label: 'answers cite original sources' },
] satisfies ReadonlyArray<{ number: string; label: string }>;

export function ProofStripSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.proof-stat', {
        scrollTrigger: { trigger: sectionRef.current, start: 'top 85%' },
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.12,
        ease: 'power2.out',
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{
        pt: 0,
        pb: { xs: 5, md: 7 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="md">
        <Box
          sx={{
            width: 40,
            height: '1px',
            bgcolor: 'divider',
            mx: 'auto',
            mb: { xs: 4, md: 5 },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: { xs: 4, md: 8 },
            flexWrap: 'wrap',
          }}
        >
          {STATS.map((stat) => (
            <Box
              key={stat.label}
              className="proof-stat"
              sx={{ textAlign: 'center', minWidth: 140 }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '2rem', md: '2.5rem' },
                  fontWeight: 800,
                  lineHeight: 1.2,
                  color: 'text.primary',
                  fontFamily: '"Newsreader", "Georgia", serif',
                }}
              >
                {stat.number}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: 'text.secondary',
                  mt: 0.5,
                  maxWidth: 160,
                  mx: 'auto',
                }}
              >
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
