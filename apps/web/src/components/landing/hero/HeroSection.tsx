import { useCallback, useEffect, useRef } from 'react';

import { alpha, Box, Button, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

import { DemoRequestDrawer } from '../DemoRequestDrawer';
import { BRAND_LOGOS } from '../IntegrationLogos';

import { HeroBackground } from './HeroBackground';

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
      tl.from('.hero-logos', { y: 10, opacity: 0, duration: 0.4, ease: 'power2.out' }, '-=0.2');
    }, containerRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        background:
          theme.palette.mode === 'dark'
            ? `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(ct, 0.04)} 0%, transparent 70%)`
            : `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(ct, 0.03)} 0%, transparent 70%)`,
      }}
    >
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          px: 2,
        }}
      >
        <HeroBackground />
        <Box sx={{ textAlign: 'center', maxWidth: 720, position: 'relative', zIndex: 1 }}>
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
            Your data has answers. Just ask.
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
            Turn scattered files and conversations into a knowledge base you can talk to.
          </Typography>

          <Box
            className="hero-ctas"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              mb: 4,
            }}
          >
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowRightIcon size={18} weight="light" />}
                sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
              >
                Start for free
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

          {/* Integration logos */}
          <Box
            className="hero-logos"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: alpha(ct, 0.3),
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Works with
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 } }}>
              {BRAND_LOGOS.map((brand) => (
                <Box
                  key={brand.name}
                  sx={{
                    opacity: 0.4,
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.7 },
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <brand.Logo size={20} />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
