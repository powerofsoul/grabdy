import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function ProofStripSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.proof-line', {
        scrollTrigger: { trigger: sectionRef.current, start: 'top 85%' },
        y: 15,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
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
            flexDirection: 'column',
            alignItems: 'center',
            gap: { xs: 1, md: 1.5 },
          }}
        >
          <Typography
            className="proof-line"
            variant="h4"
            sx={{
              fontStyle: 'italic',
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              color: alpha(ct, 0.7),
              textAlign: 'center',
              lineHeight: 1.5,
              maxWidth: 520,
            }}
          >
            One query. Every source. Real citations.
          </Typography>
          <Typography
            className="proof-line"
            variant="overline"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              mt: 1,
            }}
          >
            Slack &middot; Drive &middot; Linear &middot; Notion &middot; Confluence &middot; Gmail
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
