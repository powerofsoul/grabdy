import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const CURL_SNIPPET = `curl -X POST https://api.grabdy.com/query \\
  -H "Authorization: Bearer gbd_sk_live_..." \\
  -d '{"query": "refund policy?"}'`;

export function DevTeaserSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);

  const syntaxColors = {
    method: theme.palette.kindle.syntaxMethod,
    string: theme.palette.kindle.syntaxString,
    text: theme.palette.kindle.codeBlockText,
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.dev-teaser-card', {
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      ref={sectionRef}
      sx={{
        py: { xs: 8, md: 10 },
        bgcolor: isDark ? 'grey.50' : 'grey.900',
      }}
    >
      <Container maxWidth="lg">
        <Box
          className="dev-teaser-card"
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 3, md: 5 },
            alignItems: 'center',
            p: { xs: 3, md: 5 },
            borderRadius: 1,
          }}
        >
          {/* Left — copy */}
          <Box sx={{ flex: '1 1 60%' }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.5rem', md: '1.75rem' },
                letterSpacing: '-0.02em',
                mb: 2,
                color: isDark ? 'text.primary' : 'grey.50',
              }}
            >
              Built for developers, too.
            </Typography>
            <Typography
              sx={{
                color: isDark ? 'text.secondary' : 'grey.400',
                fontSize: '0.95rem',
                lineHeight: 1.7,
                mb: 3,
                maxWidth: 420,
              }}
            >
              Two REST endpoints, an MCP server for AI agents, and SDKs
              for every major language. Ship integrations in an afternoon.
            </Typography>
          </Box>

          {/* Right — code snippet */}
          <Box
            sx={{
              flex: '1 1 40%',
              width: '100%',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'kindle.codeBlockBg',
              border: '1px solid',
              borderColor: alpha(theme.palette.kindle.codeBlockText, 0.1),
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: '20px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {CURL_SNIPPET.split('\n').flatMap((line, li, arr) => {
                const parts: React.ReactNode[] = [];
                // Highlight curl keyword
                const curlMatch = line.match(/^(curl)\s(-X)\s(POST)\s(.+)/);
                if (curlMatch) {
                  parts.push(
                    <span key={`${li}-0`} style={{ color: syntaxColors.method, fontWeight: 600 }}>curl</span>,
                    <span key={`${li}-1`} style={{ color: syntaxColors.text }}> -X </span>,
                    <span key={`${li}-2`} style={{ color: syntaxColors.method, fontWeight: 600 }}>POST</span>,
                    <span key={`${li}-3`} style={{ color: syntaxColors.text }}> {curlMatch[4]}</span>,
                  );
                } else {
                  // Highlight strings in quotes
                  let last = 0;
                  let pi = 0;
                  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
                  let m;
                  while ((m = re.exec(line)) !== null) {
                    if (m.index > last) {
                      parts.push(
                        <span key={`${li}-${pi++}`} style={{ color: syntaxColors.text }}>
                          {line.slice(last, m.index)}
                        </span>,
                      );
                    }
                    parts.push(
                      <span key={`${li}-${pi++}`} style={{ color: syntaxColors.string }}>
                        {m[1]}
                      </span>,
                    );
                    last = m.index + m[0].length;
                  }
                  if (last < line.length) {
                    parts.push(
                      <span key={`${li}-${pi++}`} style={{ color: syntaxColors.text }}>
                        {line.slice(last)}
                      </span>,
                    );
                  }
                  if (parts.length === 0) {
                    parts.push(<span key={`${li}-0`} style={{ color: syntaxColors.text }}>{line}</span>);
                  }
                }
                if (li < arr.length - 1) parts.push('\n');
                return parts;
              })}
            </pre>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
