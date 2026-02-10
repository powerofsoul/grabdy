import { useEffect, useRef } from 'react';

import { Box, Container, Grid, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Cpu, Search, Upload } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    icon: <Upload size={40} />,
    step: '01',
    title: 'Upload your documents',
    description: 'Drag and drop files in any supported format. We accept PDF, CSV, DOCX, TXT, and JSON.',
  },
  {
    icon: <Cpu size={40} />,
    step: '02',
    title: 'Automatic indexing',
    description: 'We chunk, embed, and index your data automatically. No configuration needed.',
  },
  {
    icon: <Search size={40} />,
    step: '03',
    title: 'Query instantly',
    description: 'Search with natural language via API or built-in chat. Results in milliseconds.',
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.hiw-steps',
          start: 'top 75%',
        },
      });

      tl.from('.hiw-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.hiw-step', { y: 40, opacity: 0, duration: 0.5, stagger: 0.2 }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      id="how-it-works"
      sx={{
        py: 12,
        bgcolor: isDark ? 'grey.50' : 'grey.100',
      }}
    >
      <Container maxWidth="lg">
        <Typography
          className="hiw-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: 8,
            fontWeight: 800,
            fontSize: { xs: '2rem', md: '2.5rem' },
          }}
        >
          How it works
        </Typography>

        <Grid container spacing={4} className="hiw-steps">
          {STEPS.map((step, i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Box
                className="hiw-step"
                sx={{
                  textAlign: 'center',
                  px: 3,
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                  }}
                >
                  {step.icon}
                </Box>
                <Typography
                  variant="overline"
                  sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 2 }}
                >
                  Step {step.step}
                </Typography>
                <Typography variant="h5" sx={{ mt: 1, mb: 1.5, fontWeight: 600 }}>
                  {step.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {step.description}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
