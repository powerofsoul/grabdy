import { useEffect, useRef } from 'react';

import { Box, Button, Container, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

const CODE_SNIPPET = `curl -X POST https://api.fastdex.io/query \\
  -H "X-API-Key: fdx_..." \\
  -d '{"query": "What is our refund policy?"}'`;

export function HeroSection() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-headline span', {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
      });

      gsap.from('.hero-subtitle', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        delay: 0.6,
        ease: 'power3.out',
      });

      gsap.from('.hero-buttons', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        delay: 0.8,
        ease: 'power3.out',
      });

      gsap.from('.hero-code', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        delay: 1.0,
        ease: 'power3.out',
      });

      // Typewriter effect on the code block
      if (codeRef.current) {
        const fullText = CODE_SNIPPET;
        codeRef.current.textContent = '';
        const chars = fullText.split('');
        let i = 0;
        const typeTimer = setInterval(() => {
          if (codeRef.current && i < chars.length) {
            codeRef.current.textContent += chars[i];
            i++;
          } else {
            clearInterval(typeTimer);
          }
        }, 20);

        return () => clearInterval(typeTimer);
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const headline = 'Your data. Instantly searchable.';
  const words = headline.split(' ');

  return (
    <Box
      ref={containerRef}
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.1) 0%, transparent 50%), #09090b'
          : 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.06) 0%, transparent 50%), #fafafa',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Box sx={{ maxWidth: 720, mx: 'auto', textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h1"
            className="hero-headline"
            sx={{
              fontSize: { xs: '2.5rem', md: '4rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 3,
              letterSpacing: '-0.03em',
            }}
          >
            {words.map((word, i) => (
              <span key={i} style={{ display: 'inline-block', marginRight: '0.3em' }}>
                {word}
              </span>
            ))}
          </Typography>

          <Typography
            className="hero-subtitle"
            variant="h5"
            sx={{
              color: 'text.secondary',
              fontWeight: 400,
              mb: 4,
              fontSize: { xs: '1.1rem', md: '1.35rem' },
            }}
          >
            Upload documents, let AI index them, and query with natural language.
            Built for developers who need fast, reliable vector search.
          </Typography>

          <Box className="hero-buttons" sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Link to="/auth/register" style={{ textDecoration: 'none' }}>
              <Button variant="contained" size="large" sx={{ px: 4, py: 1.5 }}>
                Get Started Free
              </Button>
            </Link>
            <Button
              variant="outlined"
              size="large"
              sx={{ px: 4, py: 1.5 }}
              onClick={() => scrollToSection('demo')}
            >
              See Demo
            </Button>
          </Box>
        </Box>

        <Box
          className="hero-code"
          sx={{
            maxWidth: 600,
            mx: 'auto',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: isDark ? '#0f0f0f' : '#1e1e2e',
          }}
        >
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff5f57' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#febc2e' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#28c840' }} />
          </Box>
          <pre
            ref={codeRef}
            style={{
              margin: 0,
              padding: '16px 20px',
              fontFamily: '"SF Mono", "Fira Code", monospace',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#a6e3a1',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          />
        </Box>
      </Container>
    </Box>
  );
}
