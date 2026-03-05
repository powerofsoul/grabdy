import { useCallback, useEffect, useRef } from 'react';

import { alpha, Box, Button, Container, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

import { DemoRequestDrawer } from '../DemoRequestDrawer';

import { HeroBackground } from './HeroBackground';

import dashboardPreview from '@/assets/dashboard-preview.png';
import { useDrawer } from '@/context/DrawerContext';

export function HeroSection() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;

  const { pushDrawer } = useDrawer();

  const openDemoDrawer = useCallback(() => {
    pushDrawer((onClose) => <DemoRequestDrawer onClose={onClose} />, {
      title: 'Request a demo',
    });
  }, [pushDrawer]);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Hero entrance animations ──
  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const headline = containerRef.current?.querySelector('.hero-headline');
      if (headline) {
        const text = headline.textContent ?? '';
        headline.innerHTML = '';
        text.split(' ').forEach((word, i) => {
          const wrapper = document.createElement('span');
          wrapper.style.display = 'inline-block';
          wrapper.style.overflow = 'hidden';
          wrapper.style.verticalAlign = 'top';
          if (i > 0) headline.appendChild(document.createTextNode(' '));

          const inner = document.createElement('span');
          inner.style.display = 'inline-block';
          inner.textContent = word;
          inner.className = 'hero-word';
          wrapper.appendChild(inner);
          headline.appendChild(wrapper);
        });
      }

      const tl = gsap.timeline({ delay: 0.2 });

      tl.from('.hero-word', {
        yPercent: 110,
        rotateX: 10,
        stagger: 0.06,
        duration: 0.7,
        ease: 'power3.out',
      });

      tl.from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');
      tl.from('.hero-ctas', { y: 15, opacity: 0, duration: 0.4, ease: 'power2.out' }, '-=0.2');
      tl.from(
        '.hero-screenshot',
        { y: 60, opacity: 0, duration: 0.8, ease: 'power2.out' },
        '-=0.1'
      );
    }, containerRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'visible',
        pb: { xs: 8, md: 14 },
        background:
          theme.palette.mode === 'dark'
            ? `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(ct, 0.04)} 0%, transparent 70%)`
            : `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(ct, 0.03)} 0%, transparent 70%)`,
      }}
    >
      {/* Background layer that covers hero + screenshot area */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <HeroBackground />
      </Box>

      {/* Content */}
      <Box
        sx={{
          pt: { xs: 16, md: 20 },
          pb: { xs: 4, md: 6 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          px: 2,
        }}
      >
        <Box sx={{ textAlign: 'center', maxWidth: 720 }}>
          <Typography
            className="hero-headline"
            variant="h1"
            sx={{
              fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4rem' },
              fontWeight: 700,
              lineHeight: 1.1,
              mb: 2.5,
              letterSpacing: '-0.04em',
            }}
          >
            Never miss a contract deadline again.
          </Typography>

          <Typography
            className="hero-subtitle"
            sx={{
              color: 'text.secondary',
              fontWeight: 400,
              mb: 4,
              fontSize: { xs: '1.05rem', md: '1.2rem' },
              lineHeight: 1.6,
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            Auto-renewal traps, buried notice periods, expiring NDAs. Grabdy extracts every deadline
            from your contracts and alerts you before it is too late.
          </Typography>

          <Box
            className="hero-ctas"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowRightIcon size={18} weight="light" />}
                sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
              >
                Start free trial
              </Button>
            </Link>
            <Typography
              component="button"
              onClick={openDemoDrawer}
              sx={{
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'text.secondary',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.15s',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Request a demo
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Dashboard screenshot, half in hero, half overlapping next section */}
      <Container
        maxWidth="lg"
        className="hero-screenshot"
        sx={{ position: 'relative', zIndex: 2, mb: { xs: -20, md: -32 } }}
      >
        <Box
          sx={{
            border: '1px solid',
            borderColor: alpha(ct, 0.1),
            boxShadow: `0 40px 100px ${alpha(ct, 0.1)}, 0 8px 32px ${alpha(ct, 0.05)}`,
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          {/* Browser chrome */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 2,
              py: 1,
              borderBottom: '1px solid',
              borderColor: alpha(ct, 0.08),
              bgcolor: alpha(ct, 0.02),
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: alpha(ct, 0.1) }}
                />
              ))}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  px: 3,
                  py: 0.25,
                  bgcolor: alpha(ct, 0.04),
                  borderRadius: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.6rem', color: alpha(ct, 0.35), fontWeight: 500 }}>
                  app.grabdy.com
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Full platform screenshot */}
          <Box
            component="img"
            src={dashboardPreview}
            alt="Grabdy contract dashboard showing active contracts, deadlines, and portfolio metrics"
            sx={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </Box>
      </Container>
    </Box>
  );
}
