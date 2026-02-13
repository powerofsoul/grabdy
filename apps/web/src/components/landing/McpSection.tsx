import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const MCP_CONFIG = `{
  "mcpServers": {
    "grabdy": {
      "url": "https://mcp.grabdy.com/sse",
      "headers": {
        "Authorization": "Bearer gbd_sk_..."
      }
    }
  }
}`;

export function McpSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);

  const syntaxColors = {
    key: theme.palette.kindle.syntaxKey,
    string: theme.palette.kindle.syntaxString,
    text: theme.palette.kindle.codeBlockText,
    method: theme.palette.kindle.syntaxMethod,
    number: theme.palette.kindle.syntaxNumber,
  };

  const codeBorder = alpha(theme.palette.kindle.codeBlockText, 0.1);
  const codeBorderSubtle = alpha(theme.palette.kindle.codeBlockText, 0.08);
  const codeTextDim = alpha(theme.palette.kindle.codeBlockText, 0.5);
  const codeTextMuted = alpha(theme.palette.kindle.codeBlockText, 0.35);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
      tl.from('.mcp-heading', { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' });
      tl.from('.mcp-config', { y: 30, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
      tl.from('.mcp-cli', { y: 30, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const monoStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    lineHeight: 1.8,
  } satisfies React.CSSProperties;

  return (
    <Box
      ref={sectionRef}
      sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        {/* Heading */}
        <Box className="mcp-heading" sx={{ mb: { xs: 4, md: 5 }, maxWidth: 560 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}
          >
            Model Context Protocol
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              mb: 2,
              color: 'text.primary',
            }}
          >
            Give your AI agent a memory.
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.95rem',
              lineHeight: 1.7,
            }}
          >
            Connect Claude, Cursor, or any MCP-compatible agent to your
            company knowledge in one config block. Ask a question — the AI
            searches every source you've connected and answers with citations.
          </Typography>
        </Box>

        {/* Two panels */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 2, md: 2.5 },
            alignItems: 'stretch',
          }}
        >
          {/* Left — config */}
          <Box
            className="mcp-config"
            sx={{
              flex: { md: '0 0 38%' },
              width: '100%',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'kindle.codeBlockBg',
              border: '1px solid',
              borderColor: codeBorder,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TitleBar label="claude_desktop_config.json" borderColor={codeBorderSubtle} textColor={codeTextDim} />
            <pre style={{ ...monoStyle, margin: 0, padding: '20px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>
              {renderJson(MCP_CONFIG, syntaxColors)}
            </pre>
          </Box>

          {/* Right — CLI conversation */}
          <Box
            className="mcp-cli"
            sx={{
              flex: { md: '1 1 62%' },
              width: '100%',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'kindle.codeBlockBg',
              border: '1px solid',
              borderColor: codeBorder,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TitleBar label="Terminal" borderColor={codeBorderSubtle} textColor={codeTextDim} />
            <Box sx={{ p: '20px', flex: 1 }}>
              {/* User prompt */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                <span style={{ ...monoStyle, color: syntaxColors.method, fontWeight: 600, flexShrink: 0 }}>{'>'}</span>
                <span style={{ ...monoStyle, color: syntaxColors.text }}>
                  What&apos;s our refund policy for enterprise customers?
                </span>
              </Box>

              {/* Tool call */}
              <Box sx={{ mb: 2.5, pl: '18px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <span style={{ ...monoStyle, color: syntaxColors.number }}>{'⟳'}</span>
                  <span style={{ ...monoStyle, fontSize: '0.72rem', color: codeTextDim }}>
                    grabdy_search(&quot;refund policy enterprise&quot;)
                  </span>
                </Box>
                <span style={{ ...monoStyle, fontSize: '0.72rem', color: codeTextMuted }}>
                  {'  '}Found 3 sources
                </span>
              </Box>

              {/* AI answer */}
              <Box sx={{ pl: '18px', mb: 2.5 }}>
                <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
                  Based on the Enterprise SLA and the updated policy
                </span>
                <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
                  shared in #legal-updates:
                </span>
                <Box sx={{ mt: 1.5 }}>
                  <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
                    Enterprise customers get a <span style={{ color: syntaxColors.key }}>full refund within 30 days</span>.
                  </span>
                  <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
                    After 30 days, refunds are <span style={{ color: syntaxColors.key }}>prorated based on usage</span>,
                  </span>
                  <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
                    minus a 5% processing fee per the Q4 amendment.
                  </span>
                </Box>
              </Box>

              {/* Sources */}
              <Box sx={{ pl: '18px', borderTop: '1px solid', borderColor: codeBorderSubtle, pt: 1.5 }}>
                <span style={{ ...monoStyle, fontSize: '0.7rem', color: codeTextMuted, display: 'block', marginBottom: 4 }}>
                  Sources
                </span>
                {[
                  { icon: '📄', name: 'Q4-handbook.pdf', detail: 'page 12' },
                  { icon: '💬', name: '#legal-updates', detail: 'Mar 14' },
                  { icon: '📋', name: 'LEGAL-248', detail: 'Linear' },
                ].map((s) => (
                  <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <span style={{ fontSize: '0.7rem' }}>{s.icon}</span>
                    <span style={{ ...monoStyle, fontSize: '0.72rem', color: syntaxColors.string }}>
                      {s.name}
                    </span>
                    <span style={{ ...monoStyle, fontSize: '0.72rem', color: codeTextMuted }}>
                      — {s.detail}
                    </span>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ── Helpers ── */

function TitleBar({ label, borderColor, textColor }: { label: string; borderColor: string; textColor: string }) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderBottom: '1px solid',
        borderColor,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: textColor,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

interface SyntaxColors {
  key: string;
  string: string;
  text: string;
}

function renderJson(code: string, colors: SyntaxColors) {
  return code.split('\n').flatMap((line, li, arr) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let pi = 0;

    const re = /("(?:[^"\\]|\\.)*")\s*(:?)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.text }}>
            {line.slice(last, m.index)}
          </span>,
        );
      }
      const isKey = m[2] === ':';
      parts.push(
        <span key={`${li}-${pi++}`} style={{ color: isKey ? colors.key : colors.string }}>
          {m[1]}
        </span>,
      );
      if (isKey) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.text }}>:</span>,
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
        <span key={`${li}-0`} style={{ color: colors.text }}>{line}</span>,
      );
    }
    if (li < arr.length - 1) parts.push('\n');
    return parts;
  });
}
