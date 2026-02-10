import { useEffect, useRef, useState } from 'react';

import { alpha, Box, Chip, Container, Tab, Tabs, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const QUERY_REQUEST = `POST /api/orgs/:orgId/query
X-API-Key: gbd_sk_live_...
Content-Type: application/json

{
  "query": "What is the refund policy?",
  "collectionId": "col_...",
  "limit": 5
}`;

const QUERY_RESPONSE = `{
  "success": true,
  "data": {
    "results": [
      {
        "content": "Digital product refunds are processed within 5-7 business days after approval. Customers have a 30-day window from purchase.",
        "score": 0.94,
        "dataSourceName": "refund-policy.pdf",
        "metadata": {}
      },
      {
        "content": "Cancellations take effect at the end of the current billing period. No partial refunds for unused time.",
        "score": 0.87,
        "dataSourceName": "billing-terms.docx",
        "metadata": {}
      }
    ],
    "queryTimeMs": 23
  }
}`;

const CHAT_REQUEST = `POST /api/orgs/:orgId/chat
X-API-Key: gbd_sk_live_...
Content-Type: application/json

{
  "message": "What is the refund policy?",
  "collectionId": "col_...",
  "threadId": "thr_..."
}`;

const CHAT_RESPONSE = `{
  "success": true,
  "data": {
    "answer": "Digital product refunds are processed within 5-7 business days after approval. Customers have a 30-day window from the date of purchase to request a refund.",
    "threadId": "thr_a1b2c3d4...",
    "sources": [
      {
        "dataSourceName": "refund-policy.pdf",
        "content": "...refunds are processed within 5-7 business days...",
        "score": 0.94
      }
    ]
  }
}`;

const MCP_REQUEST = `// claude_desktop_config.json
{
  "mcpServers": {
    "grabdy": {
      "command": "npx",
      "args": ["-y", "@grabdy/mcp-server"],
      "env": {
        "GRABDY_API_KEY": "gbd_sk_live_...",
        "GRABDY_ORG_ID": "org_..."
      }
    }
  }
}`;

const MCP_RESPONSE = `Available tools:

  grabdy_query
    Search documents by semantic similarity.
    Parameters: query (string), limit? (number), collectionId? (string)

  grabdy_chat
    Conversational RAG with thread memory.
    Parameters: message (string), threadId? (string), collectionId? (string)

  grabdy_upload
    Upload a file to a collection.
    Parameters: filePath (string), collectionId (string)

  grabdy_collections
    List all collections in the organization.`;

const TABS = [
  { label: 'Query', request: QUERY_REQUEST, response: QUERY_RESPONSE },
  { label: 'Chat', request: CHAT_REQUEST, response: CHAT_RESPONSE },
  { label: 'MCP Server', request: MCP_REQUEST, response: MCP_RESPONSE },
];

// ─── Syntax highlighting ─────────────────────────────────────────

interface SyntaxColors {
  method: string;
  text: string;
  headerKey: string;
  headerVal: string;
  key: string;
  string: string;
  number: string;
  punct: string;
}

function highlightCode(text: string, colors: SyntaxColors): React.ReactNode[] {
  return text.split('\n').flatMap((line, lineIdx, arr) => {
    const elements: React.ReactNode[] = [];

    // HTTP method line: POST /api/...
    const methodMatch = line.match(/^(POST|GET|PUT|DELETE|PATCH)\s+(.+)/);
    if (methodMatch) {
      elements.push(
        <span key={`${lineIdx}-m`} style={{ color: colors.method, fontWeight: 600 }}>{methodMatch[1]}</span>,
        <span key={`${lineIdx}-u`} style={{ color: colors.text }}>{' '}{methodMatch[2]}</span>,
      );
    }
    // Header line: Key: Value
    else if (/^[A-Z][A-Za-z-]+:/.test(line)) {
      const colonIdx = line.indexOf(': ');
      if (colonIdx >= 0) {
        elements.push(
          <span key={`${lineIdx}-hk`} style={{ color: colors.headerKey }}>{line.slice(0, colonIdx + 2)}</span>,
          <span key={`${lineIdx}-hv`} style={{ color: colors.headerVal }}>{line.slice(colonIdx + 2)}</span>,
        );
      } else {
        elements.push(<span key={`${lineIdx}-h`} style={{ color: colors.headerKey }}>{line}</span>);
      }
    }
    // JSON or other content
    else {
      let lastIdx = 0;
      let partIdx = 0;
      const regex = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b(?:true|false|null)\b)|(\b\d+\.?\d*\b)/g;
      let match;

      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIdx) {
          elements.push(
            <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.punct }}>
              {line.slice(lastIdx, match.index)}
            </span>,
          );
        }

        if (match[1] && match[2]) {
          // JSON key: "key":
          elements.push(
            <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.key }}>{match[1]}</span>,
            <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.punct }}>{match[2]}</span>,
          );
        } else if (match[1]) {
          // JSON string value
          elements.push(
            <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.string }}>{match[1]}</span>,
          );
        } else if (match[3]) {
          // Boolean/null
          elements.push(
            <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.number }}>{match[3]}</span>,
          );
        } else if (match[4]) {
          // Number
          elements.push(
            <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.number }}>{match[4]}</span>,
          );
        }

        lastIdx = match.index + match[0].length;
      }

      if (lastIdx < line.length) {
        elements.push(
          <span key={`${lineIdx}-${partIdx++}`} style={{ color: colors.punct }}>
            {line.slice(lastIdx)}
          </span>,
        );
      }

      if (elements.length === 0) {
        elements.push(<span key={`${lineIdx}-0`}>{line}</span>);
      }
    }

    if (lineIdx < arr.length - 1) {
      elements.push('\n');
    }

    return elements;
  });
}

// ─── Typewriter ──────────────────────────────────────────────────

function useTypewriter(text: string, active: boolean, speed = 10) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!active || hasRunRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setTyped(text);
      setDone(true);
      hasRunRef.current = true;
      return;
    }

    hasRunRef.current = true;
    let charIdx = 0;
    const interval = setInterval(() => {
      charIdx += 2;
      if (charIdx >= text.length) {
        clearInterval(interval);
        setTyped(text);
        setDone(true);
        return;
      }
      setTyped(text.slice(0, charIdx));
    }, speed);

    return () => clearInterval(interval);
  }, [active, text, speed]);

  // Reset when text changes (tab switch)
  useEffect(() => {
    setTyped('');
    setDone(false);
    hasRunRef.current = false;
  }, [text]);

  return { typed, done };
}

// ─── Main Section ────────────────────────────────────────────────

export function ApiDemoSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const currentTab = TABS[tabIndex];
  const { typed, done } = useTypewriter(currentTab.response, isVisible, 6);

  const syntaxColors: SyntaxColors = {
    method: theme.palette.kindle.syntaxMethod,
    text: theme.palette.kindle.codeBlockText,
    headerKey: alpha(theme.palette.kindle.codeBlockText, 0.45),
    headerVal: alpha(theme.palette.kindle.codeBlockText, 0.7),
    key: theme.palette.kindle.syntaxKey,
    string: theme.palette.kindle.syntaxString,
    number: theme.palette.kindle.syntaxNumber,
    punct: alpha(theme.palette.kindle.codeBlockText, 0.3),
  };

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        });

        tl.from('.api-demo-title', { y: 30, opacity: 0, duration: 0.6 });
        tl.from('.api-demo-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');
        tl.from('.api-demo-panel', { y: 40, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.2');
      }

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 65%',
        onEnter: () => setIsVisible(true),
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const codeFontStyle = {
    margin: 0,
    fontFamily: '"SF Mono", "Fira Code", monospace',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  };

  return (
    <Box ref={sectionRef} id="api-demo" sx={{ py: { xs: 10, md: 14 }, bgcolor: 'kindle.parchment' }}>
      <Container maxWidth="lg">
        <Typography
          className="api-demo-title"
          variant="h2"
          sx={{ textAlign: 'center', mb: 2, fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' }, letterSpacing: '-0.02em' }}
        >
          Two endpoints or one{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>MCP server</Box>.
          {' '}That&apos;s it.
        </Typography>
        <Typography
          className="api-demo-subtitle"
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 6, maxWidth: 600, mx: 'auto' }}
        >
          Semantic search with{' '}
          <Chip
            label="/query"
            size="small"
            variant="outlined"
            sx={{
              height: 22,
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              fontWeight: 600,
              verticalAlign: 'middle',
              borderColor: alpha(theme.palette.primary.main, 0.3),
              color: 'primary.main',
            }}
          />
          . Conversational RAG with{' '}
          <Chip
            label="/chat"
            size="small"
            variant="outlined"
            sx={{
              height: 22,
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              fontWeight: 600,
              verticalAlign: 'middle',
              borderColor: alpha(theme.palette.primary.main, 0.3),
              color: 'primary.main',
            }}
          />
          . Or plug in the MCP server and let your AI handle it.
        </Typography>

        <Box
          className="api-demo-panel"
          sx={{
            maxWidth: 800,
            mx: 'auto',
            borderRadius: 2.5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: alpha(theme.palette.kindle.codeBlockText, 0.15),
            transition: 'box-shadow 0.3s',
            boxShadow: theme.palette.mode === 'dark'
              ? `0 20px 60px ${alpha(theme.palette.common.black, 0.5)}, 0 0 40px ${alpha(theme.palette.primary.main, 0.06)}`
              : `0 20px 60px ${alpha(theme.palette.primary.main, 0.08)}, 0 0 40px ${alpha(theme.palette.primary.main, 0.04)}`,
            '&:hover': {
              boxShadow: theme.palette.mode === 'dark'
                ? `0 24px 70px ${alpha(theme.palette.common.black, 0.6)}, 0 0 50px ${alpha(theme.palette.primary.main, 0.1)}`
                : `0 24px 70px ${alpha(theme.palette.primary.main, 0.12)}, 0 0 50px ${alpha(theme.palette.primary.main, 0.06)}`,
            },
          }}
        >
          {/* Tabs */}
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
              <Tab label="/query" />
              <Tab label="/chat" />
              <Tab label="MCP" />
            </Tabs>
          </Box>

          {/* Request */}
          <Box sx={{ bgcolor: 'kindle.codeBlockBg' }}>
            <Box
              sx={{
                px: 2,
                py: 0.75,
                borderBottom: '1px solid',
                borderColor: alpha(theme.palette.kindle.codeBlockText, 0.08),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'kindle.codeBlockText',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    opacity: 0.5,
                  }}
                >
                  {tabIndex === 2 ? 'Config' : 'Request'}
                </Typography>
                {tabIndex < 2 && (
                  <Chip
                    label="POST"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      bgcolor: alpha(theme.palette.kindle.syntaxMethod, 0.15),
                      color: theme.palette.kindle.syntaxMethod,
                      border: 'none',
                    }}
                  />
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex' }}>
              <Box
                sx={{
                  py: '16px',
                  pl: '16px',
                  pr: '8px',
                  borderRight: '1px solid',
                  borderColor: alpha(theme.palette.kindle.codeBlockText, 0.06),
                  userSelect: 'none',
                }}
              >
                {currentTab.request.split('\n').map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      ...codeFontStyle,
                      fontSize: '0.75rem',
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
                  ...codeFontStyle,
                  padding: '16px 16px',
                  fontSize: '0.75rem',
                  lineHeight: 1.7,
                  flex: 1,
                }}
              >
                {highlightCode(currentTab.request, syntaxColors)}
              </pre>
            </Box>
          </Box>

          {/* Response */}
          <Box
            sx={{
              bgcolor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.black, 0.3)
                : alpha(theme.palette.common.black, 0.05),
              borderTop: '1px solid',
              borderColor: alpha(theme.palette.kindle.codeBlockText, 0.1),
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 0.75,
                borderBottom: '1px solid',
                borderColor: alpha(theme.palette.kindle.codeBlockText, 0.08),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'kindle.codeBlockText',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    opacity: 0.5,
                  }}
                >
                  {tabIndex === 2 ? 'Tools' : 'Response'}
                </Typography>
                {done && tabIndex < 2 && (
                  <Chip
                    label="200 OK"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      bgcolor: alpha(theme.palette.success.main, 0.15),
                      color: theme.palette.success.main,
                      border: 'none',
                    }}
                  />
                )}
              </Box>
            </Box>
            <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
              <pre
                style={{
                  ...codeFontStyle,
                  padding: '16px 20px',
                  fontSize: '0.72rem',
                  lineHeight: 1.7,
                }}
              >
                {highlightCode(typed, syntaxColors)}
                {!done && isVisible && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      backgroundColor: theme.palette.primary.main,
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'cursorBlink 0.8s step-end infinite',
                    }}
                  />
                )}
              </pre>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

// Keep backward-compatible export name for index.tsx migration
export { ApiDemoSection as ChatDemoSection };
