import { alpha, Box, useTheme } from '@mui/material';

import { FONT_MONO } from '@/theme';

const CURL_SNIPPET = `curl -X POST https://api.grabdy.com/query \\
  -H "Authorization: Bearer gbd_sk_live_..." \\
  -d '{"query": "termination clause Acme MSA"}'`;

export function ApiPanel() {
  const theme = useTheme();

  const syntaxColors = {
    method: theme.palette.kindle.syntaxMethod,
    string: theme.palette.kindle.syntaxString,
    text: theme.palette.kindle.codeBlockText,
  };

  return (
    <Box
      sx={{
        maxWidth: 520,
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
          fontFamily: FONT_MONO,
          fontSize: '0.78rem',
          lineHeight: 1.8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {CURL_SNIPPET.split('\n').flatMap((line, li, arr) => {
          const parts: React.ReactNode[] = [];
          const curlMatch = line.match(/^(curl)\s(-X)\s(POST)\s(.+)/);
          if (curlMatch) {
            parts.push(
              <span key={`${li}-0`} style={{ color: syntaxColors.method, fontWeight: 600 }}>
                curl
              </span>,
              <span key={`${li}-1`} style={{ color: syntaxColors.text }}>
                {' '}
                -X{' '}
              </span>,
              <span key={`${li}-2`} style={{ color: syntaxColors.method, fontWeight: 600 }}>
                POST
              </span>,
              <span key={`${li}-3`} style={{ color: syntaxColors.text }}>
                {' '}
                {curlMatch[4]}
              </span>
            );
          } else {
            let last = 0;
            let pi = 0;
            const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
            let m;
            while ((m = re.exec(line)) !== null) {
              if (m.index > last) {
                parts.push(
                  <span key={`${li}-${pi++}`} style={{ color: syntaxColors.text }}>
                    {line.slice(last, m.index)}
                  </span>
                );
              }
              parts.push(
                <span key={`${li}-${pi++}`} style={{ color: syntaxColors.string }}>
                  {m[1]}
                </span>
              );
              last = m.index + m[0].length;
            }
            if (last < line.length) {
              parts.push(
                <span key={`${li}-${pi++}`} style={{ color: syntaxColors.text }}>
                  {line.slice(last)}
                </span>
              );
            }
            if (parts.length === 0) {
              parts.push(
                <span key={`${li}-0`} style={{ color: syntaxColors.text }}>
                  {line}
                </span>
              );
            }
          }
          if (li < arr.length - 1) parts.push('\n');
          return parts;
        })}
      </pre>
    </Box>
  );
}
