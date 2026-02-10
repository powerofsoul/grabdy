import { useEffect, useRef } from 'react';

import { alpha, Box, Button, Chip, Container, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export function CTASection() {
  const theme = useTheme();
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

      tl.from('.cta-ring', { scale: 0.8, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out' });
      tl.from('.cta-title', { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.6');
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
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${theme.palette.kindle.parchment} 0%, ${alpha(theme.palette.primary.main, 0.06)} 50%, ${theme.palette.kindle.parchment} 100%)`,
      }}
    >
      {/* Decorative concentric rings */}
      {[700, 500, 350].map((size, i) => (
        <Box
          key={size}
          className="cta-ring"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size,
            height: size,
            borderRadius: '50%',
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.08 - i * 0.02),
            pointerEvents: 'none',
          }}
        />
      ))}

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
          Ready in{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>minutes</Box>.
        </Typography>
        <Typography
          className="cta-subtitle"
          sx={{ mb: 5, color: 'text.secondary', fontSize: '1.1rem', lineHeight: 1.6 }}
        >
          Create an account, upload your files, and start asking.
          <br />
          That&apos;s it.
        </Typography>

        <Box className="cta-button" sx={{ mb: 2.5 }}>
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
                boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.25)}`,
                '&:hover': {
                  boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.35)}`,
                },
              }}
            >
              Get Started Free
            </Button>
          </Link>
        </Box>

        <Box className="cta-note" sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          {['Create account', 'Upload files', 'Start asking'].map((step, i) => (
            <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={i + 1}
                size="small"
                variant="outlined"
                sx={{
                  width: 22,
                  height: 22,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  '& .MuiChip-label': { px: 0 },
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  color: 'primary.main',
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                {step}
              </Typography>
              {i < 2 && (
                <Typography color="text.secondary" sx={{ opacity: 0.3, fontSize: '0.7rem' }}>
                  &rarr;
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2.5, display: 'block', fontSize: '0.75rem' }}>
          No credit card required.
        </Typography>
      </Container>
    </Box>
  );
}
