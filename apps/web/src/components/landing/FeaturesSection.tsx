import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { MockMessageBubble } from './features-chat/components/MockMessageBubble';
import { MOCK_CONVERSATION } from './features-chat/constants';

gsap.registerPlugin(ScrollTrigger);

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.features-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.features-subtitle', { y: 20, opacity: 0, duration: 0.5 }, '-=0.3');
      tl.from(
        '.mock-message',
        {
          y: 20,
          opacity: 0,
          duration: 0.4,
          stagger: 0.12,
          ease: 'power2.out',
        },
        '-=0.2'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      id="features"
      sx={{
        pt: { xs: 28, md: 40 },
        pb: { xs: 10, md: 14 },
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Typography
            className="features-title"
            variant="overline"
            sx={{
              mb: 1.5,
              display: 'block',
              color: 'text.secondary',
            }}
          >
            What you can do
          </Typography>
          <Typography
            className="features-title"
            variant="h2"
            sx={{
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 600,
            }}
          >
            Ask your contracts anything.
          </Typography>
          <Typography
            className="features-subtitle"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '0.9rem', md: '1rem' },
              lineHeight: 1.6,
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            From deadline tracking to clause lookup, Grabdy turns your contract library into an
            always-available legal knowledge base.
          </Typography>
        </Box>

        {/* Mock chat window */}
        <Box
          sx={{
            maxWidth: 680,
            mx: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(ct, 0.02),
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                bgcolor: 'success.main',
                borderRadius: '50%',
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
              Contract Assistant
            </Typography>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              p: { xs: 2, md: 3 },
            }}
          >
            {MOCK_CONVERSATION.map((msg, i) => (
              <MockMessageBubble key={i} message={msg} />
            ))}
          </Box>

          {/* Input bar */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(ct, 0.02),
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>
                Ask about your contracts...
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
