import { useEffect, useRef, useState } from 'react';

import { alpha, Box, Container, Tab, Tabs, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const CODE_SNIPPETS = [
  {
    label: 'cURL',
    code: `curl -X POST https://api.grabdy.com/api/orgs/:orgId/query \\
  -H "X-API-Key: gbd_sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What is the refund policy?", "limit": 5}'`,
  },
  {
    label: 'TypeScript',
    code: `const res = await fetch("https://api.grabdy.com/api/orgs/:orgId/query", {
  method: "POST",
  headers: {
    "X-API-Key": "gbd_sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: "What is the refund policy?", limit: 5 }),
});

const { data } = await res.json();
console.log(data.results, data.queryTimeMs);`,
  },
  {
    label: 'Python',
    code: `import requests

res = requests.post(
    "https://api.grabdy.com/api/orgs/:orgId/query",
    headers={"X-API-Key": "gbd_sk_live_..."},
    json={"query": "What is the refund policy?", "limit": 5},
)

data = res.json()["data"]
print(data["results"], data["queryTimeMs"])`,
  },
];

// ─── Syntax highlighting ─────────────────────────────────────────

function highlightSnippet(
  code: string,
  colors: { text: string; keyword: string; string: string; number: string },
): React.ReactNode[] {
  return code.split('\n').flatMap((line, li, arr) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let pi = 0;

    const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(const|let|await|import|curl|fetch|print|POST|GET|JSON)\b|(\b\d+\b)/g;
    let m;

    while ((m = re.exec(line)) !== null) {
      if (m.index > last) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.text }}>
            {line.slice(last, m.index)}
          </span>,
        );
      }
      if (m[1]) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.string }}>
            {m[1]}
          </span>,
        );
      } else if (m[2]) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.keyword, fontWeight: 600 }}>
            {m[2]}
          </span>,
        );
      } else if (m[3]) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.number }}>
            {m[3]}
          </span>,
        );
      }
      last = m.index + m[0].length;
    }

    if (last < line.length) {
      parts.push(
        <span key={`${li}-${pi++}`} style={{ color: colors.text }}>
          {line.slice(last)}
        </span>,
      );
    }

    if (parts.length === 0) {
      parts.push(
        <span key={`${li}-0`} style={{ color: colors.text }}>
          {line}
        </span>,
      );
    }

    if (li < arr.length - 1) parts.push('\n');
    return parts;
  });
}

// ─── Main Section ────────────────────────────────────────────────

export function IntegrationSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [tabIndex, setTabIndex] = useState(0);

  const syntaxColors = {
    text: theme.palette.kindle.codeBlockText,
    keyword: theme.palette.kindle.syntaxMethod,
    string: theme.palette.kindle.syntaxString,
    number: theme.palette.kindle.syntaxNumber,
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.integration-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.integration-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');
      tl.from('.integration-panel', { y: 40, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} id="integration" sx={{ py: { xs: 10, md: 14 }, bgcolor: 'kindle.parchment' }}>
      <Container maxWidth="md">
        <Typography
          className="integration-title"
          variant="h2"
          sx={{ textAlign: 'center', mb: 2, fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' }, letterSpacing: '-0.02em' }}
        >
          Integrate in{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>your language</Box>.
        </Typography>
        <Typography
          className="integration-subtitle"
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 6, maxWidth: 480, mx: 'auto' }}
        >
          Three lines to search your documents. Copy, paste, ship.
        </Typography>

        <Box
          className="integration-panel"
          sx={{
            borderRadius: 2.5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: alpha(theme.palette.kindle.codeBlockText, 0.15),
            transition: 'box-shadow 0.3s',
            boxShadow: theme.palette.mode === 'dark'
              ? `0 12px 40px ${alpha(theme.palette.common.black, 0.4)}, 0 0 30px ${alpha(theme.palette.primary.main, 0.05)}`
              : `0 12px 40px ${alpha(theme.palette.primary.main, 0.06)}, 0 0 30px ${alpha(theme.palette.primary.main, 0.03)}`,
            '&:hover': {
              boxShadow: theme.palette.mode === 'dark'
                ? `0 16px 50px ${alpha(theme.palette.common.black, 0.5)}, 0 0 40px ${alpha(theme.palette.primary.main, 0.08)}`
                : `0 16px 50px ${alpha(theme.palette.primary.main, 0.1)}, 0 0 40px ${alpha(theme.palette.primary.main, 0.05)}`,
            },
          }}
        >
          <Box
            sx={{
              bgcolor: 'kindle.codeBlockBg',
              borderBottom: '1px solid',
              borderColor: alpha(theme.palette.kindle.codeBlockText, 0.1),
            }}
          >
            <Tabs
              value={tabIndex}
              onChange={(_, v: number) => setTabIndex(v)}
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  color: alpha(theme.palette.kindle.codeBlockText, 0.5),
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  minHeight: 40,
                  textTransform: 'none',
                  '&.Mui-selected': {
                    color: 'kindle.codeBlockText',
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: 'primary.main',
                },
              }}
            >
              {CODE_SNIPPETS.map((snippet) => (
                <Tab key={snippet.label} label={snippet.label} />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ bgcolor: 'kindle.codeBlockBg', display: 'flex' }}>
            {/* Line numbers */}
            <Box
              sx={{
                py: '20px',
                pl: '16px',
                pr: '8px',
                borderRight: '1px solid',
                borderColor: alpha(theme.palette.kindle.codeBlockText, 0.06),
                userSelect: 'none',
              }}
            >
              {CODE_SNIPPETS[tabIndex].code.split('\n').map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    fontSize: '0.78rem',
                    lineHeight: 1.7,
                    color: alpha(theme.palette.kindle.codeBlockText, 0.2),
                    textAlign: 'right',
                    minWidth: 20,
                  }}
                >
                  {i + 1}
                </Box>
              ))}
            </Box>
            <pre
              style={{
                margin: 0,
                padding: '20px 16px',
                fontFamily: '"SF Mono", "Fira Code", monospace',
                fontSize: '0.78rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                minHeight: 180,
                flex: 1,
              }}
            >
              {highlightSnippet(CODE_SNIPPETS[tabIndex].code, syntaxColors)}
            </pre>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
