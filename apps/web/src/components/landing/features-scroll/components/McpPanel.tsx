import { alpha, Box, Typography, useTheme } from '@mui/material';

import { FONT_MONO } from '@/theme';

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

export function McpPanel() {
  const theme = useTheme();

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

  const monoStyle = {
    fontFamily: FONT_MONO,
    fontSize: '0.78rem',
    lineHeight: 1.8,
  } satisfies React.CSSProperties;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 2, md: 2 },
        alignItems: 'stretch',
        maxWidth: 600,
      }}
    >
      {/* Config panel */}
      <Box
        sx={{
          flex: { md: '0 0 44%' },
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
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: '1px solid',
            borderColor: codeBorderSubtle,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.7rem', color: codeTextDim }}>
            claude_desktop_config.json
          </Typography>
        </Box>
        <pre
          style={{
            ...monoStyle,
            margin: 0,
            padding: '16px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            flex: 1,
          }}
        >
          {renderJson(MCP_CONFIG, syntaxColors)}
        </pre>
      </Box>

      {/* Terminal panel */}
      <Box
        sx={{
          flex: { md: '1 1 56%' },
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
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: '1px solid',
            borderColor: codeBorderSubtle,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.7rem', color: codeTextDim }}>
            Terminal
          </Typography>
        </Box>
        <Box sx={{ p: '16px', flex: 1 }}>
          {/* Prompt */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <span
              style={{ ...monoStyle, color: syntaxColors.method, fontWeight: 600, flexShrink: 0 }}
            >
              {'>'}
            </span>
            <span style={{ ...monoStyle, color: syntaxColors.text }}>
              What&apos;s our refund policy?
            </span>
          </Box>

          {/* Tool call */}
          <Box sx={{ mb: 2, pl: '18px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <span style={{ ...monoStyle, color: syntaxColors.number }}>{'⟳'}</span>
              <span style={{ ...monoStyle, fontSize: '0.72rem', color: codeTextDim }}>
                grabdy_search(&quot;refund policy&quot;)
              </span>
            </Box>
            <span style={{ ...monoStyle, fontSize: '0.72rem', color: codeTextMuted }}>
              {'  '}Found 3 sources
            </span>
          </Box>

          {/* Answer */}
          <Box sx={{ pl: '18px', mb: 2 }}>
            <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
              Full refund within <span style={{ color: syntaxColors.key }}>30 days</span>.
            </span>
            <span style={{ ...monoStyle, color: syntaxColors.text, display: 'block' }}>
              After that, <span style={{ color: syntaxColors.key }}>prorated</span> minus 5% fee.
            </span>
          </Box>

          {/* Sources */}
          <Box sx={{ pl: '18px', borderTop: '1px solid', borderColor: codeBorderSubtle, pt: 1.5 }}>
            <span
              style={{
                ...monoStyle,
                fontSize: '0.7rem',
                color: codeTextMuted,
                display: 'block',
                marginBottom: 4,
              }}
            >
              Sources
            </span>
            {[
              { icon: '\uD83D\uDCC4', name: 'handbook.pdf', detail: 'page 12' },
              { icon: '\uD83D\uDCAC', name: '#legal-updates', detail: 'Mar 14' },
            ].map((s) => (
              <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                <span style={{ fontSize: '0.7rem' }}>{s.icon}</span>
                <span style={{ ...monoStyle, fontSize: '0.72rem', color: syntaxColors.string }}>
                  {s.name}
                </span>
                <span style={{ ...monoStyle, fontSize: '0.72rem', color: codeTextMuted }}>
                  · {s.detail}
                </span>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
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
          </span>
        );
      }
      const isKey = m[2] === ':';
      parts.push(
        <span key={`${li}-${pi++}`} style={{ color: isKey ? colors.key : colors.string }}>
          {m[1]}
        </span>
      );
      if (isKey) {
        parts.push(
          <span key={`${li}-${pi++}`} style={{ color: colors.text }}>
            :
          </span>
        );
      }
      last = m.index + m[0].length;
    }

    if (last < line.length) {
      parts.push(
        <span key={`${li}-${pi++}`} style={{ color: colors.text }}>
          {line.slice(last)}
        </span>
      );
    }
    if (parts.length === 0) {
      parts.push(
        <span key={`${li}-0`} style={{ color: colors.text }}>
          {line}
        </span>
      );
    }
    if (li < arr.length - 1) parts.push('\n');
    return parts;
  });
}
