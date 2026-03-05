import { useCallback, useEffect, useRef } from 'react';

import { alpha, Box, Button, Container, Typography, useTheme } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { DemoRequestDrawer } from './DemoRequestDrawer';

import illustCrystals from '@/assets/illust-crystals.svg';
import { useDrawer } from '@/context/DrawerContext';

gsap.registerPlugin(ScrollTrigger);

export function CTASection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;
  const { pushDrawer } = useDrawer();

  const openDemoDrawer = useCallback(() => {
    pushDrawer((onClose) => <DemoRequestDrawer onClose={onClose} />, {
      title: 'Request a demo',
    });
  }, [pushDrawer]);

  // Magnetic button effect
  const handleButtonMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.2;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.2;
    gsap.to(btn, { x, y, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  }, []);

  const handleButtonMouseLeave = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Split title words for reveal
      const title = sectionRef.current?.querySelector('.cta-title');
      if (title) {
        const text = title.textContent ?? '';
        title.innerHTML = '';
        text.split(' ').forEach((word, i) => {
          const wrapper = document.createElement('span');
          wrapper.style.display = 'inline-block';
          wrapper.style.overflow = 'hidden';
          wrapper.style.verticalAlign = 'top';
          if (i > 0) title.appendChild(document.createTextNode(' '));
          const inner = document.createElement('span');
          inner.style.display = 'inline-block';
          inner.className = 'cta-word';
          inner.textContent = word;
          wrapper.appendChild(inner);
          title.appendChild(wrapper);
        });
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
        },
      });

      tl.from('.cta-word', {
        yPercent: 110,
        stagger: 0.05,
        duration: 0.6,
        ease: 'power3.out',
      });
      tl.from('.cta-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');
      tl.from(
        '.cta-button-wrapper',
        { y: 20, opacity: 0, duration: 0.4, ease: 'back.out(1.5)' },
        '-=0.2'
      );
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
        overflow: 'hidden',
      }}
    >
      {/* Floating illustration, crystals */}
      <Box
        component="img"
        src={illustCrystals}
        alt=""
        aria-hidden="true"
        sx={{
          position: 'absolute',
          left: { xs: '-8%', md: '3%' },
          bottom: { xs: '10%', md: '15%' },
          width: { xs: 100, md: 160 },
          opacity: theme.palette.mode === 'dark' ? 0.04 : 0.05,
          filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
          pointerEvents: 'none',
          animation: 'ctaCrystalFloat 10s ease-in-out infinite',
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
          },
          '@keyframes ctaCrystalFloat': {
            '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
            '50%': { transform: 'translateY(-12px) rotate(-3deg)' },
          },
        }}
      />

      {/* Floating dots background */}
      {Array.from({ length: 12 }).map((_, i) => (
        <Box
          key={i}
          className="cta-dot"
          sx={{
            position: 'absolute',
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            borderRadius: '50%',
            bgcolor: alpha(ct, 0.06 + (i % 4) * 0.02),
            left: `${8 + ((i * 7.5) % 85)}%`,
            top: `${10 + ((i * 13) % 80)}%`,
            animation: `ctaFloat${i % 3} ${6 + (i % 4) * 2}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
            '@keyframes ctaFloat0': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-15px)' },
            },
            '@keyframes ctaFloat1': {
              '0%, 100%': { transform: 'translateY(0) translateX(0)' },
              '50%': { transform: 'translateY(-10px) translateX(5px)' },
            },
            '@keyframes ctaFloat2': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-20px)' },
            },
          }}
        />
      ))}

      <Container maxWidth="sm" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Typography
          className="cta-title"
          variant="h2"
          sx={{
            mb: 2,
            fontSize: { xs: '2rem', md: '2.75rem' },
          }}
        >
          Stop digging through contracts. Start getting answers.
        </Typography>
        <Typography
          className="cta-subtitle"
          sx={{ mb: 1.5, color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.6 }}
        >
          Start your free 30-day trial. No credit card required.
        </Typography>
        <Typography
          className="cta-subtitle"
          sx={{ mb: 5, color: 'text.secondary', fontSize: '0.85rem' }}
        >
          Legal teams at growing companies already use Grabdy.
        </Typography>

        <Box
          className="cta-button-wrapper"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'center',
            gap: 2,
            mb: 2,
          }}
        >
          {/* Magnetic button wrapper */}
          <Box
            onMouseMove={handleButtonMouseMove}
            onMouseLeave={handleButtonMouseLeave}
            sx={{ display: 'inline-flex', p: 2, m: -2 }}
          >
            <Box ref={buttonRef}>
              <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowRightIcon size={18} weight="light" color="currentColor" />}
                  sx={{
                    px: 6,
                    py: 1.75,
                    fontSize: '1.05rem',
                    position: 'relative',
                    overflow: 'hidden',
                    // Pulsing glow behind button
                    boxShadow: `0 0 40px ${alpha(ct, 0.08)}, 0 0 80px ${alpha(ct, 0.04)}`,
                    // Shimmer sweep on hover
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '50%',
                      height: '100%',
                      background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.background.default, 0.15)}, transparent)`,
                      transition: 'none',
                    },
                    '&:hover::after': {
                      animation: 'btnShimmer 0.6s ease-out',
                    },
                    '@keyframes btnShimmer': {
                      '0%': { left: '-50%' },
                      '100%': { left: '150%' },
                    },
                  }}
                >
                  Get Started
                </Button>
              </Link>
            </Box>
          </Box>
        </Box>

        <Box
          className="cta-note"
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}
        >
          <Typography
            component="button"
            onClick={openDemoDrawer}
            sx={{
              fontSize: '0.85rem',
              color: 'text.secondary',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
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
