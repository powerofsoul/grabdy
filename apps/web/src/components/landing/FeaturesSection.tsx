import { useEffect, useRef } from 'react';

import { Box, Card, CardContent, Container, Grid, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Code, FileText, MessageSquare, Zap } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: <Zap size={32} />,
    title: 'Lightning Fast',
    description: 'Vector search retrieves results in milliseconds, powered by optimized embeddings.',
  },
  {
    icon: <FileText size={32} />,
    title: 'Multiple Formats',
    description: 'PDF, CSV, DOCX, TXT, and JSON. Upload any document and we handle the rest.',
  },
  {
    icon: <Code size={32} />,
    title: 'API-First',
    description: 'Simple REST API with key authentication. Integrate in minutes, not days.',
  },
  {
    icon: <MessageSquare size={32} />,
    title: 'Chat Interface',
    description: 'Built-in chatbot for instant answers from your data. No prompt engineering needed.',
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.feature-title', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: '.feature-title',
          start: 'top 80%',
        },
      });

      gsap.from('.feature-card', {
        y: 40,
        opacity: 0,
        duration: 0.5,
        stagger: 0.15,
        scrollTrigger: {
          trigger: '.feature-cards-grid',
          start: 'top 80%',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} id="features" sx={{ py: 12, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Typography
          className="feature-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: 6,
            fontWeight: 800,
            fontSize: { xs: '2rem', md: '2.5rem' },
          }}
        >
          Everything you need
        </Typography>

        <Grid container spacing={3} className="feature-cards-grid">
          {FEATURES.map((feature, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                className="feature-card"
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.palette.mode === 'dark'
                      ? '0 8px 32px rgba(0,0,0,0.4)'
                      : '0 8px 32px rgba(0,0,0,0.08)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
