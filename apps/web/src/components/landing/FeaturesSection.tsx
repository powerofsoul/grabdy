import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileText, Lightning, PuzzlePiece, Sparkle } from '@phosphor-icons/react';

gsap.registerPlugin(ScrollTrigger);

interface Feature {
  icon: typeof Lightning;
  title: string;
  description: string;
  proof: string;
  colorKey: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

const HERO_FEATURES = [
  {
    icon: FileText,
    title: 'Cites real sources',
    description: 'Every response links back to the exact file, page, and passage. No hallucinated answers.',
    proof: 'Searching manually: hope for the best. Grabdy: direct link to file, page, and paragraph.',
    colorKey: 'primary',
  },
  {
    icon: Lightning,
    title: 'Sub-second answers',
    description: 'Fast enough that people use it instead of asking a teammate.',
    proof: 'Asking a teammate: 4 hours. Grabdy: 23ms.',
    colorKey: 'warning',
  },
] satisfies ReadonlyArray<Feature>;

const SECONDARY_FEATURES = [
  {
    icon: PuzzlePiece,
    title: 'Works across your whole stack',
    description: 'Searches Slack, Drive, Linear, Notion at once.',
    proof: 'One query searches Slack, Drive, Linear, Notion, Confluence, and Gmail at once.',
    colorKey: 'info',
  },
  {
    icon: Sparkle,
    title: 'Remembers context',
    description: 'Follow-up questions build on previous answers.',
    proof: 'Ask follow-ups like you would a colleague — no re-explaining.',
    colorKey: 'success',
  },
] satisfies ReadonlyArray<Feature>;

function FeatureCard({ feature, large }: { feature: Feature; large?: boolean }) {
  const theme = useTheme();
  const Icon = feature.icon;
  const ct = theme.palette.text.primary;

  return (
    <Box
      className={large ? 'feature-hero-card' : 'feature-secondary-card'}
      sx={{
        p: large ? { xs: 3, md: 4 } : 3,
        border: '1px solid',
        borderColor: 'grey.900',
        borderTop: `2px solid ${ct}`,
        bgcolor: 'transparent',
      }}
    >
      <Box sx={{ mb: 2, color: 'text.primary' }}>
        <Icon size={large ? 26 : 22} weight="light" color="currentColor" />
      </Box>
      <Typography
        variant={large ? 'h5' : 'h6'}
        sx={{ mb: 1 }}
      >
        {feature.title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: 1.6, fontSize: '0.85rem', mb: 1.5 }}
      >
        {feature.description}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: alpha(ct, 0.5),
        }}
      >
        {feature.proof}
      </Typography>
    </Box>
  );
}

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.features-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.feature-hero-card', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '-=0.3');
      tl.from('.feature-secondary-card', { y: 25, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      id="features"
      sx={{
        py: { xs: 10, md: 14 },
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          className="features-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 7 },
            fontSize: { xs: '2rem', md: '2.5rem' },
          }}
        >
          Why Grabdy.
        </Typography>

        {/* 2 hero cards — stacked, full width */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, md: 2.5 },
            maxWidth: 900,
            mx: 'auto',
            mb: { xs: 2, md: 2.5 },
          }}
        >
          {HERO_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} large />
          ))}
        </Box>

        {/* 2 secondary cards — side by side */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 2, md: 2.5 },
            maxWidth: 900,
            mx: 'auto',
          }}
        >
          {SECONDARY_FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </Box>
      </Container>
    </Box>
  );
}
