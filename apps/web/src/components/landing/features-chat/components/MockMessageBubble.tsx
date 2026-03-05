import { alpha, Box, Typography, useTheme } from '@mui/material';

import type { MockMessage, MockSource } from '../types';

import { CitationBadge } from './CitationBadge';

function renderInline(
  text: string,
  sources: ReadonlyArray<MockSource> | undefined
): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\{\{\d+\}\})/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Box key={i} component="span" sx={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </Box>
      );
    }

    const citationMatch = /^\{\{(\d+)\}\}$/.exec(part);
    if (citationMatch) {
      const refNum = Number(citationMatch[1]);
      const source = sources?.[refNum - 1];
      if (source) {
        return <CitationBadge key={i} refNumber={refNum} source={source} />;
      }
      return null;
    }

    return part;
  });
}

function renderContent(text: string, sources: ReadonlyArray<MockSource> | undefined) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line === '') {
      elements.push(<Box key={key++} sx={{ height: 8 }} />);
      continue;
    }

    if (line.startsWith('- ')) {
      const content = line.slice(2);
      elements.push(
        <Box
          key={key++}
          component="li"
          sx={{ ml: 2, fontSize: '0.82rem', lineHeight: 1.6, mt: 0.25 }}
        >
          {renderInline(content, sources)}
        </Box>
      );
      continue;
    }

    elements.push(
      <Typography
        key={key++}
        component="span"
        sx={{ display: 'block', fontSize: '0.82rem', lineHeight: 1.6 }}
      >
        {renderInline(line, sources)}
      </Typography>
    );
  }

  return elements;
}

export function MockMessageBubble({ message }: { message: MockMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const ct = theme.palette.text.primary;

  return (
    <Box
      className="mock-message"
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <Box
        sx={{
          maxWidth: '85%',
          ...(isUser
            ? {
                bgcolor: alpha(ct, 0.04),
                px: 2,
                py: 1.25,
              }
            : {
                borderLeft: '2px solid',
                borderColor: 'text.primary',
                px: 2,
                py: 1.25,
              }),
        }}
      >
        {isUser ? (
          <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
        ) : (
          <Box>{renderContent(message.content, message.sources)}</Box>
        )}
      </Box>
    </Box>
  );
}
