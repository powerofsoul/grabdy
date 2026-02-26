import { useEffect, useRef } from 'react';

import { alpha, Box, Button, useScrollTrigger, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';

import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

export function LandingNav() {
  const theme = useTheme();
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 30 });
  const navRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !navRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(navRef.current, {
        y: -20,
        opacity: 0,
        duration: 0.6,
        delay: 0.15,
        ease: 'power2.out',
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        display: 'flex',
        justifyContent: 'center',
        pt: { xs: 1.5, md: 2 },
        px: 2,
        pointerEvents: 'none',
      }}
    >
      <Box
        ref={navRef}
        sx={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 2 },
          px: { xs: 2, md: 2.5 },
          py: 1,
          borderRadius: 50,
          bgcolor: trigger
            ? alpha(theme.palette.background.paper, 0.82)
            : alpha(theme.palette.background.paper, 0.45),
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid',
          borderColor: trigger ? alpha(ct, 0.15) : alpha(ct, 0.1),
          boxShadow: trigger
            ? `0 4px 24px ${alpha(ct, 0.08)}, 0 1px 3px ${alpha(ct, 0.04)}`
            : `0 2px 12px ${alpha(ct, 0.03)}`,
          transition: 'background-color 0.35s, border-color 0.35s, box-shadow 0.35s',
          maxWidth: 720,
          width: '100%',
        }}
      >
        <Logo size="sm" />

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Right actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ThemeToggle />
          <Link to="/auth/login" style={{ textDecoration: 'none' }}>
            <Button
              variant="text"
              size="small"
              sx={{
                fontWeight: 500,
                fontSize: '0.8rem',
                color: 'text.secondary',
                minWidth: 'auto',
                px: 1.5,
                '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              Log in
            </Button>
          </Link>
          <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
            <Button
              variant="contained"
              size="small"
              sx={{
                px: 2,
                py: 0.5,
                fontSize: '0.78rem',
                borderRadius: 50,
              }}
            >
              Get Started
            </Button>
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
