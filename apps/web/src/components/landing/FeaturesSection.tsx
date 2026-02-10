import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Clock, Puzzle, Search, Sparkles, Upload, Zap } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: Zap,
    title: 'Up and running in minutes',
    description:
      'Create an account, upload your files, and start querying. No infrastructure to manage, no models to tune.',
    colorKey: 'warning',
  },
  {
    icon: Search,
    title: 'Answers, not links',
    description:
      'Ask a question in plain English. Get a direct answer with the exact source file and passage it came from.',
    colorKey: 'primary',
  },
  {
    icon: Upload,
    title: 'Drop any file',
    description:
      'PDF, DOCX, CSV, TXT, JSON, images — upload through the dashboard or API. We handle parsing and indexing automatically.',
    colorKey: 'success',
  },
  {
    icon: Puzzle,
    title: 'Works with your stack',
    description:
      'REST API, MCP server, or the dashboard. Use whatever fits your workflow. Integrate in any language.',
    colorKey: 'secondary',
  },
  {
    icon: Sparkles,
    title: 'Conversations that remember',
    description:
      'Follow-up questions just work. Threads keep context so you can dig deeper without repeating yourself.',
    colorKey: 'info',
  },
  {
    icon: Clock,
    title: 'Fast enough to feel instant',
    description:
      'Queries return in under 50ms. Chat responses stream in real time. Your users never wait.',
    colorKey: 'error',
  },
] satisfies ReadonlyArray<{ icon: typeof Zap; title: string; description: string; colorKey: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' }>;

export function FeaturesSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.features-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.features-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');
      tl.from('.feature-card', { y: 30, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} id="features" sx={{ py: { xs: 10, md: 14 }, bgcolor: 'kindle.parchment', position: 'relative', overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Typography
          className="features-title"
          variant="h2"
          sx={{ textAlign: 'center', mb: 2, fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' }, letterSpacing: '-0.02em' }}
        >
          Why teams choose{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>grabdy</Box>.
        </Typography>
        <Typography
          className="features-subtitle"
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 7, maxWidth: 520, mx: 'auto' }}
        >
          Stop building RAG pipelines. Start shipping answers.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: { xs: 2, md: 3 },
            maxWidth: 960,
            mx: 'auto',
          }}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            const paletteColor = theme.palette[feature.colorKey].main;
            return (
              <Box
                key={feature.title}
                className="feature-card"
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                  '&:hover': {
                    borderColor: alpha(paletteColor, 0.3),
                    boxShadow: `0 8px 30px ${alpha(paletteColor, 0.1)}`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    bgcolor: alpha(paletteColor, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  <Icon size={22} color={paletteColor} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontSize: '0.95rem' }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: '0.82rem' }}>
                  {feature.description}
                </Typography>
              </Box>
            );
          })}
        </Box>

      </Container>
    </Box>
  );
}
